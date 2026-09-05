import { randomUUID } from 'crypto';
import { generateAIDecision } from '@/lib/ai/decision';
import { evaluatePolicy } from '@/lib/policy';
import { recordAuditEvent } from '@/lib/audit';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { AIDecision, HumanReview, PolicyDecisionRecord, Transaction } from '@/types';

export interface AgentRunOutput {
  transactionId: string;
  status: 'PENDING_APPROVAL' | 'HUMAN_REVIEW' | 'BLOCKED' | 'NO_ACTION';
  decision: AIDecision;
  policy: PolicyDecisionRecord;
  review?: HumanReview;
}

function savePolicyDecision(transaction: Transaction, decision: AIDecision, policy: ReturnType<typeof evaluatePolicy>): PolicyDecisionRecord {
  return inMemoryStore.insertPolicyDecision({
    id: `pol-${randomUUID()}`,
    transaction_id: transaction.id,
    ai_decision_id: decision.id,
    decision: policy.decision,
    approved_strategy: policy.decision === 'ALLOW' ? decision.recommended_strategy : null,
    matched_rules: [policy.rule_id],
    violation_reasons: policy.decision === 'ALLOW' ? [] : [policy.reason],
    is_override_required: policy.requires_human,
    evaluated_at: new Date().toISOString(),
  });
}

function getPendingReview(transactionId: string): HumanReview | undefined {
  return inMemoryStore.getHumanReviews().find((review) => review.transaction_id === transactionId && review.review_status === 'PENDING');
}

export async function runRecoveryAgent(transaction: Transaction): Promise<AgentRunOutput> {
  const existingReview = getPendingReview(transaction.id);
  const existingDecision = inMemoryStore.getAIDecisions(transaction.id)[0];
  const decision = existingDecision ?? (await generateAIDecision(transaction));
  const policyEvaluation = evaluatePolicy(transaction, {
    recommended_strategy: decision.recommended_strategy,
    confidence_score: decision.confidence_score,
  });

  const existingPolicy = inMemoryStore.getPolicyDecisions(transaction.id).find((policy) => policy.ai_decision_id === decision.id);
  const policy = existingPolicy ?? savePolicyDecision(transaction, decision, policyEvaluation);
  const ruleId = policy.matched_rules[0] ?? policyEvaluation.rule_id;

  recordAuditEvent({
    event_type: 'AI_DIAGNOSIS', actor_type: 'AI_ENGINE', actor_id: decision.model_name,
    transaction_id: transaction.id, what: 'Agent diagnosed the revenue risk and generated a recovery recommendation.',
    why: decision.concise_rationale, result: decision.recommended_strategy,
    action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
    state_after: { diagnosis_code: decision.diagnosis_code, confidence_score: decision.confidence_score, expected_recovery_value: decision.raw_llm_response?.expected_recovery_value ?? null },
  });

  recordAuditEvent({
    event_type: 'POLICY_CHECK', actor_type: 'POLICY_ENGINE', actor_id: 'deterministic-policy-engine',
    transaction_id: transaction.id, rule_id: ruleId,
    what: 'Agent recommendation was checked against deterministic recovery policy.', why: policyEvaluation.reason,
    result: policyEvaluation.decision, action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
    state_after: { requires_human: policyEvaluation.requires_human },
  });

  if (policyEvaluation.decision === 'BLOCK') {
    inMemoryStore.updateTransaction(transaction.id, { status: 'REJECTED_BY_POLICY' });
    recordAuditEvent({
      event_type: 'POLICY_BLOCKED', actor_type: 'POLICY_ENGINE', actor_id: 'deterministic-policy-engine',
      transaction_id: transaction.id, rule_id: ruleId, what: 'Recovery action was blocked.', why: policyEvaluation.reason,
      result: 'BLOCKED', action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
    });
    return { transactionId: transaction.id, status: 'BLOCKED', decision, policy };
  }

  if (decision.recommended_strategy === 'no_action') {
    inMemoryStore.updateTransaction(transaction.id, { status: 'CLOSED_UNRESOLVED' });
    return { transactionId: transaction.id, status: 'NO_ACTION', decision, policy };
  }

  const review = existingReview ?? inMemoryStore.insertHumanReview({
    id: `rev-${randomUUID()}`, transaction_id: transaction.id, ai_decision_id: decision.id, review_status: 'PENDING',
    trigger_reason: policyEvaluation.decision === 'ALLOW' ? 'Agent recommendation is policy-allowed, but financial execution requires explicit human authorization.' : policyEvaluation.reason,
    created_at: new Date().toISOString(),
  });

  if (!existingReview) {
    inMemoryStore.updateTransaction(transaction.id, { status: policyEvaluation.decision === 'ALLOW' ? 'POLICY_APPROVED' : 'NEEDS_HUMAN_REVIEW' });
    recordAuditEvent({
      event_type: 'HUMAN_REVIEW_REQUIRED', actor_type: 'SYSTEM', actor_id: 'recovery-agent', transaction_id: transaction.id,
      rule_id: ruleId, what: 'Agent paused before financial execution and requested human authorization.', why: review.trigger_reason,
      result: 'PENDING_APPROVAL', action_taken: decision.recommended_strategy, amount_in_inr: transaction.amount_in_inr,
    });
  }

  return { transactionId: transaction.id, status: policyEvaluation.decision === 'ALLOW' ? 'PENDING_APPROVAL' : 'HUMAN_REVIEW', decision, policy, review };
}
