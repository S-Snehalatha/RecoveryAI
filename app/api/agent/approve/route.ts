import { NextResponse } from 'next/server';
import { evaluatePolicy } from '@/lib/policy';
import { recordAuditEvent } from '@/lib/audit';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { getExecutionAdapter } from '@/lib/razorpay/adapter';
import { AIStrategy } from '@/types';

interface ApprovalRequest {
  transactionId?: string;
  reviewId?: string;
  approved?: boolean;
  reviewerId?: string;
  reviewerNotes?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApprovalRequest;
    if (!body.transactionId || !body.reviewId || typeof body.approved !== 'boolean') {
      return NextResponse.json({ error: 'transactionId, reviewId and approved are required' }, { status: 400 });
    }

    const transaction = inMemoryStore.getTransactionById(body.transactionId);
    const review = inMemoryStore.getHumanReviews().find((item) => item.id === body.reviewId);
    if (!transaction || !review || review.transaction_id !== body.transactionId) {
      return NextResponse.json({ error: 'Transaction or review not found' }, { status: 404 });
    }
    if (review.review_status !== 'PENDING') {
      return NextResponse.json({ error: 'This approval request has already been resolved' }, { status: 409 });
    }

    const decision = review.ai_decision_id
      ? inMemoryStore.getAIDecisions(transaction.id).find((item) => item.id === review.ai_decision_id)
      : inMemoryStore.getAIDecisions(transaction.id)[0];
    if (!decision) {
      return NextResponse.json({ error: 'AI recommendation not found for this review' }, { status: 409 });
    }

    if (!body.approved) {
      const updatedReview = inMemoryStore.updateHumanReview(review.id, {
        review_status: 'REJECTED',
        reviewer_id: body.reviewerId ?? 'human-operator',
        reviewer_notes: body.reviewerNotes ?? 'Recovery action rejected by human operator.',
      });
      inMemoryStore.updateTransaction(transaction.id, { status: 'CLOSED_UNRESOLVED' });
      recordAuditEvent({
        event_type: 'HUMAN_REJECTED',
        actor_type: 'HUMAN_OPERATOR',
        actor_id: body.reviewerId ?? 'human-operator',
        transaction_id: transaction.id,
        what: 'Human operator rejected the agent recovery recommendation.',
        why: body.reviewerNotes ?? 'Operator chose not to proceed.',
        result: 'REJECTED',
        action_taken: decision.recommended_strategy,
        amount_in_inr: transaction.amount_in_inr,
      });
      return NextResponse.json({ success: true, status: 'REJECTED', review: updatedReview }, { status: 200 });
    }

    const policy = inMemoryStore.getPolicyDecisions(transaction.id).find((item) => item.ai_decision_id === decision.id);
    const policyEvaluation = evaluatePolicy(transaction, {
      recommended_strategy: decision.recommended_strategy,
      confidence_score: decision.confidence_score,
    });

    if (policyEvaluation.decision !== 'ALLOW') {
      return NextResponse.json(
        { error: 'Current policy does not allow this action. Human approval cannot override policy.', policy: policyEvaluation },
        { status: 409 },
      );
    }

    if (!policy || policy.decision !== 'ALLOW' || policy.approved_strategy !== decision.recommended_strategy) {
      return NextResponse.json({ error: 'Stored policy decision is stale or inconsistent with the current policy' }, { status: 409 });
    }

    const ruleId = policy.matched_rules[0];
    if (!ruleId) {
      return NextResponse.json({ error: 'Stored policy decision is missing its matched rule' }, { status: 409 });
    }

    const existingAttempt = inMemoryStore.getRecoveryAttempts(transaction.id)[0];
    if (existingAttempt) {
      return NextResponse.json({ error: 'Recovery has already been executed for this transaction' }, { status: 409 });
    }

    const reviewerId = body.reviewerId ?? 'human-operator';
    const updatedReview = inMemoryStore.updateHumanReview(review.id, {
      review_status: 'APPROVED',
      reviewer_id: reviewerId,
      reviewer_notes: body.reviewerNotes ?? 'Approved by human operator.',
      final_action: decision.recommended_strategy,
    });

    recordAuditEvent({
      event_type: 'HUMAN_APPROVED', actor_type: 'HUMAN_OPERATOR', actor_id: reviewerId,
      transaction_id: transaction.id, rule_id: ruleId,
      what: 'Human operator approved the agent recommendation after a fresh policy check.',
      why: body.reviewerNotes ?? 'Operator authorized the proposed recovery action.',
      result: 'APPROVED', action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
    });

    const adapter = getExecutionAdapter();
    inMemoryStore.updateTransaction(transaction.id, { status: 'executing' });
    recordAuditEvent({
      event_type: 'EXECUTION_STARTED', actor_type: 'SYSTEM', actor_id: 'recovery-agent',
      transaction_id: transaction.id, rule_id: ruleId,
      what: 'Approved recovery action execution started.',
      why: 'Explicit human authorization and current policy ALLOW are both present.',
      result: 'STARTED', action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
      state_after: { execution_mode: adapter.mode, simulated: adapter.mode === 'DEMO_SIMULATION' },
    });

    try {
      const execution = await adapter.execute(transaction, decision.recommended_strategy as AIStrategy, policy.id);
      inMemoryStore.insertRecoveryAttempt(execution.attempt);

      if (execution.result) {
        inMemoryStore.insertRecoveryResult(execution.result);
        const recovered = execution.result.outcome_status === 'VERIFIED_RECOVERED';
        inMemoryStore.updateTransaction(transaction.id, { status: recovered ? 'RECOVERED' : 'RECOVERY_FAILED' });
      }

      recordAuditEvent({
        event_type: 'EXECUTION_SUCCEEDED', actor_type: 'GATEWAY_ADAPTER', actor_id: adapter.mode,
        transaction_id: transaction.id, rule_id: ruleId,
        what: 'Approved recovery action was dispatched.',
        why: 'Human authorization and deterministic policy validation passed.',
        result: execution.result?.outcome_status === 'VERIFIED_RECOVERED' ? 'VERIFIED_RECOVERED' : 'DISPATCHED',
        action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
        state_after: { execution_mode: adapter.mode, recovery_confirmed: Boolean(execution.result) },
      });

      return NextResponse.json({ success: true, status: execution.result?.outcome_status === 'VERIFIED_RECOVERED' ? 'RECOVERED' : 'EXECUTED', review: updatedReview, attempt: execution.attempt, result: execution.result ?? null }, { status: 200 });
    } catch (error) {
      inMemoryStore.updateTransaction(transaction.id, { status: 'RECOVERY_FAILED' });
      recordAuditEvent({
        event_type: 'EXECUTION_FAILED', actor_type: 'GATEWAY_ADAPTER', actor_id: adapter.mode,
        transaction_id: transaction.id, rule_id: ruleId,
        what: 'Approved recovery action could not be dispatched.',
        why: error instanceof Error ? error.message : 'Unknown gateway execution error.',
        result: 'FAILED', action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
      });
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Recovery execution failed.' }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Approval request failed.' }, { status: 500 });
  }
}
