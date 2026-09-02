import { randomUUID } from 'crypto';
import { generateAIDecision } from '@/lib/ai/decision';
import { validateAIOutput } from '@/lib/ai/schemas';
import { evaluatePolicy } from '@/lib/policy';
import { recordAuditEvent } from '@/lib/audit';
import { calculateRecoveryRate, calculateVerifiedRecovery } from '@/lib/metrics';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { executeDemoRecovery } from './demoExecutionAdapter';
import { AIDecision, BatchRun, Transaction } from '@/types';

export interface BatchRunSummary { batch: BatchRun; processed: number; recovered: number; failed: number; reviewed: number; blocked: number; recovered_amount_in_inr: number; recovery_rate: number; }

const pending = (s: Transaction['status']) => s === 'pending' || s === 'INGESTED';
const attempted = (id: string) => inMemoryStore.getRecoveryAttempts(id).length > 0;
const reviewed = (id: string) => inMemoryStore.getHumanReviews().some((r) => r.transaction_id === id && r.review_status === 'PENDING');

function audit(event_type: Parameters<typeof recordAuditEvent>[0]['event_type'], tx: Transaction, result: string, why: string, extra: Record<string, unknown> = {}) {
  recordAuditEvent({ event_type, actor_type: 'SYSTEM', actor_id: 'phase-6-batch-runner', transaction_id: tx.id, what: result, why, result, amount_in_inr: tx.amount_in_inr, state_after: extra });
}

async function processOne(tx: Transaction) {
  if (attempted(tx.id)) return;
  inMemoryStore.updateTransaction(tx.id, { status: 'processing' });
  audit('TRANSACTION_RECEIVED', tx, 'RECEIVED', 'Pending transaction selected for the batch.');

  const ai = await generateAIDecision({ ...tx, status: 'processing' });
  audit('AI_DIAGNOSIS', tx, 'DIAGNOSED', ai.concise_rationale, { strategy: ai.recommended_strategy, confidence: ai.confidence_score });
  const valid = validateAIOutput({ diagnosis: { primary_reason: ai.diagnosis_code, explanation: ai.concise_rationale }, recommended_strategy: ai.recommended_strategy, confidence: ai.confidence_score, expected_recovery_value: tx.amount_in_inr, decision_explanation: ai.concise_rationale });
  if (!valid.success) throw new Error(`AI validation failed for ${tx.id}`);
  audit('AI_STRATEGY_RECOMMENDED', tx, 'RECOMMENDED', ai.concise_rationale, { strategy: ai.recommended_strategy });

  const policy = evaluatePolicy(tx, valid.data);
  const record = inMemoryStore.insertPolicyDecision({ id: `pol-${randomUUID()}`, transaction_id: tx.id, ai_decision_id: ai.id, decision: policy.decision, approved_strategy: policy.decision === 'ALLOW' ? ai.recommended_strategy : null, matched_rules: [policy.rule_id], violation_reasons: policy.decision === 'ALLOW' ? [] : [policy.reason], is_override_required: policy.requires_human, evaluated_at: new Date().toISOString() });
  audit('POLICY_CHECK', tx, policy.decision, policy.reason, { rule_id: policy.rule_id });

  if (policy.decision === 'HUMAN_REVIEW') {
    inMemoryStore.updateTransaction(tx.id, { status: 'review' });
    if (!reviewed(tx.id)) inMemoryStore.insertHumanReview({ id: `rev-${randomUUID()}`, transaction_id: tx.id, ai_decision_id: ai.id, review_status: 'PENDING', trigger_reason: policy.reason, created_at: new Date().toISOString() });
    audit('HUMAN_REVIEW_REQUIRED', tx, 'HUMAN_REVIEW_REQUIRED', policy.reason, { rule_id: policy.rule_id });
    return;
  }
  if (policy.decision === 'BLOCK') {
    inMemoryStore.updateTransaction(tx.id, { status: 'blocked' });
    audit('POLICY_BLOCKED', tx, 'BLOCKED', policy.reason, { rule_id: policy.rule_id });
    return;
  }

  audit('POLICY_ALLOWED', tx, 'ALLOWED', policy.reason, { rule_id: policy.rule_id });
  inMemoryStore.updateTransaction(tx.id, { status: 'executing' });
  audit('EXECUTION_STARTED', tx, 'STARTED', 'Policy returned ALLOW.', { execution_mode: 'DEMO_SIMULATION', simulated: true });
  const execution = executeDemoRecovery(tx, ai.recommended_strategy, record.id);
  inMemoryStore.insertRecoveryAttempt(execution.attempt);
  inMemoryStore.insertRecoveryResult(execution.result);
  const success = execution.result.outcome_status === 'VERIFIED_RECOVERED';
  inMemoryStore.updateTransaction(tx.id, { status: success ? 'recovered' : 'failed' });
  audit(success ? 'EXECUTION_SUCCEEDED' : 'EXECUTION_FAILED', tx, success ? 'SUCCEEDED' : 'FAILED', 'SIMULATED DEMO OUTCOME', { execution_mode: 'DEMO_SIMULATION', simulated: true, label: 'SIMULATED DEMO OUTCOME' });
  audit(success ? 'RECOVERY_CONFIRMED' : 'RECOVERY_FAILED', tx, success ? 'VERIFIED_RECOVERED' : 'FAILED', 'SIMULATED DEMO OUTCOME', { execution_mode: 'DEMO_SIMULATION', simulated: true, label: 'SIMULATED DEMO OUTCOME' });
}

export async function runRecoveryBatch(runName = 'Phase 6 Demo Recovery Batch'): Promise<BatchRunSummary> {
  const batch: BatchRun = { id: `batch-${randomUUID()}`, run_name: runName, total_transactions: 0, execution_mode: 'DEMO_SIMULATION', status: 'RUNNING', metrics_summary: {}, started_at: new Date().toISOString() };
  inMemoryStore.insertBatchRun(batch);
  recordAuditEvent({ event_type: 'BATCH_STARTED', actor_type: 'SYSTEM', actor_id: 'phase-6-batch-runner', what: 'Batch started.', why: 'Demo batch requested.', result: 'RUNNING', state_after: { execution_mode: 'DEMO_SIMULATION', simulated: true } });

  const items = inMemoryStore.getTransactions().filter((tx) => pending(tx.status));
  let processed = 0; let processingErrors = 0;
  for (const tx of items) {
    try { if (!attempted(tx.id)) { await processOne(tx); processed++; } }
    catch (error) { processingErrors++; inMemoryStore.updateTransaction(tx.id, { status: 'failed' }); audit('EXECUTION_FAILED', tx, 'FAILED', error instanceof Error ? error.message : 'Unknown error.'); }
  }

  const txs = inMemoryStore.getTransactions();
  const reviewedCount = txs.filter((tx) => tx.status === 'review').length;
  const blockedCount = txs.filter((tx) => tx.status === 'blocked').length;
  const recoveredCount = txs.filter((tx) => tx.status === 'recovered').length;
  const failedCount = txs.filter((tx) => tx.status === 'failed').length;
  const verified = calculateVerifiedRecovery(inMemoryStore.getRecoveryResults());
  const base = items.reduce((sum, tx) => sum + tx.amount_in_inr, 0);
  const rate = calculateRecoveryRate(verified.recovered_amount_in_inr, base);
  const final = inMemoryStore.updateBatchRun(batch.id, { total_transactions: items.length, status: 'COMPLETED', completed_at: new Date().toISOString(), metrics_summary: { processed, recovered: recoveredCount, failed: failedCount, processing_errors: processingErrors, reviewed: reviewedCount, blocked: blockedCount, recovered_amount_in_inr: verified.recovered_amount_in_inr, recovery_rate: rate, execution_mode: 'DEMO_SIMULATION', simulated: true, label: 'SIMULATED DEMO OUTCOME' } })!;
  recordAuditEvent({ event_type: 'BATCH_COMPLETED', actor_type: 'SYSTEM', actor_id: 'phase-6-batch-runner', what: 'Batch completed.', why: 'Each pending transaction was processed independently.', result: 'COMPLETED', state_after: final.metrics_summary });
  return { batch: final, processed, recovered: recoveredCount, failed: failedCount, reviewed: reviewedCount, blocked: blockedCount, recovered_amount_in_inr: verified.recovered_amount_in_inr, recovery_rate: rate };
}
