import { randomUUID } from 'crypto';
import { generateAIDecision } from '@/lib/ai/decision';
import { validateAIOutput } from '@/lib/ai/schemas';
import { evaluatePolicy } from '@/lib/policy';
import { recordAuditEvent } from '@/lib/audit';
import { calculateRecoveryRate, calculateVerifiedRecovery } from '@/lib/metrics';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { getExecutionAdapter } from '@/lib/razorpay/adapter';
import { AIDecision, BatchRun, Transaction } from '@/types';

export interface BatchRunSummary { batch: BatchRun; processed: number; recovered: number; failed: number; reviewed: number; blocked: number; recovered_amount_in_inr: number; recovery_rate: number; }
const pending = (s: Transaction['status']) => s === 'pending' || s === 'INGESTED';
const attempted = (id: string) => inMemoryStore.getRecoveryAttempts(id).length > 0;
const hasReview = (id: string) => inMemoryStore.getHumanReviews().some((r) => r.transaction_id === id && r.review_status === 'PENDING');
function audit(type: Parameters<typeof recordAuditEvent>[0]['event_type'], tx: Transaction, result: string, why: string, extra: Record<string, unknown> = {}) {
  recordAuditEvent({ event_type: type, actor_type: 'SYSTEM', actor_id: 'phase-6-batch-runner', transaction_id: tx.id, what: result, why, result, amount_in_inr: tx.amount_in_inr, state_after: extra });
}
function savePolicy(tx: Transaction, ai: AIDecision, p: ReturnType<typeof evaluatePolicy>) {
  return inMemoryStore.insertPolicyDecision({ id: `pol-${randomUUID()}`, transaction_id: tx.id, ai_decision_id: ai.id, decision: p.decision, approved_strategy: p.decision === 'ALLOW' ? ai.recommended_strategy : null, matched_rules: [p.rule_id], violation_reasons: p.decision === 'ALLOW' ? [] : [p.reason], is_override_required: p.requires_human, evaluated_at: new Date().toISOString() });
}
async function processOne(tx: Transaction) {
  if (attempted(tx.id)) return;
  inMemoryStore.updateTransaction(tx.id, { status: 'processing' });
  audit('TRANSACTION_RECEIVED', tx, 'RECEIVED', 'Pending transaction selected.');
  const ai = await generateAIDecision({ ...tx, status: 'processing' });
  audit('AI_DIAGNOSIS', tx, 'DIAGNOSED', ai.concise_rationale, { strategy: ai.recommended_strategy, confidence: ai.confidence_score });
  const valid = validateAIOutput({ diagnosis: { primary_reason: ai.diagnosis_code, explanation: ai.concise_rationale }, recommended_strategy: ai.recommended_strategy, confidence: ai.confidence_score, expected_recovery_value: tx.amount_in_inr, decision_explanation: ai.concise_rationale });
  if (!valid.success) throw new Error(`AI validation failed for ${tx.id}`);
  audit('AI_STRATEGY_RECOMMENDED', tx, 'RECOMMENDED', ai.concise_rationale, { strategy: ai.recommended_strategy });
  const p = evaluatePolicy(tx, { recommended_strategy: valid.data.recommended_strategy, confidence_score: valid.data.confidence });
  const policy = savePolicy(tx, ai, p);
  audit('POLICY_CHECK', tx, p.decision, p.reason, { rule_id: p.rule_id });
  if (p.decision === 'HUMAN_REVIEW') {
    inMemoryStore.updateTransaction(tx.id, { status: 'review' });
    if (!hasReview(tx.id)) inMemoryStore.insertHumanReview({ id: `rev-${randomUUID()}`, transaction_id: tx.id, ai_decision_id: ai.id, review_status: 'PENDING', trigger_reason: p.reason, created_at: new Date().toISOString() });
    audit('HUMAN_REVIEW_REQUIRED', tx, 'HUMAN_REVIEW_REQUIRED', p.reason, { rule_id: p.rule_id });
    return;
  }
  if (p.decision === 'BLOCK') {
    inMemoryStore.updateTransaction(tx.id, { status: 'blocked' });
    audit('POLICY_BLOCKED', tx, 'BLOCKED', p.reason, { rule_id: p.rule_id });
    return;
  }
  const adapter = getExecutionAdapter();
  audit('POLICY_ALLOWED', tx, 'ALLOWED', p.reason, { rule_id: p.rule_id, execution_mode: adapter.mode });
  inMemoryStore.updateTransaction(tx.id, { status: 'executing' });
  audit('EXECUTION_STARTED', tx, 'STARTED', 'Policy returned ALLOW.', { execution_mode: adapter.mode, simulated: adapter.mode === 'DEMO_SIMULATION' });
  const execution = await adapter.execute(tx, ai.recommended_strategy, policy.id);
  inMemoryStore.insertRecoveryAttempt(execution.attempt);
  if (!execution.result) {
    // Payment Link creation is only a recovery attempt. Revenue is confirmed later by webhook.
    audit('EXECUTION_SUCCEEDED', tx, 'DISPATCHED', 'Payment Link created; awaiting payment confirmation.', { execution_mode: adapter.mode, recovery_confirmed: false });
    return;
  }
  inMemoryStore.insertRecoveryResult(execution.result);
  const success = execution.result.outcome_status === 'VERIFIED_RECOVERED';
  inMemoryStore.updateTransaction(tx.id, { status: success ? 'recovered' : 'failed' });
  audit(success ? 'EXECUTION_SUCCEEDED' : 'EXECUTION_FAILED', tx, success ? 'SUCCEEDED' : 'FAILED', adapter.mode === 'DEMO_SIMULATION' ? 'SIMULATED DEMO OUTCOME' : 'Gateway execution outcome.', { execution_mode: adapter.mode, simulated: adapter.mode === 'DEMO_SIMULATION', label: adapter.mode === 'DEMO_SIMULATION' ? 'SIMULATED DEMO OUTCOME' : undefined });
  audit(success ? 'RECOVERY_CONFIRMED' : 'RECOVERY_FAILED', tx, success ? 'VERIFIED_RECOVERED' : 'FAILED', adapter.mode === 'DEMO_SIMULATION' ? 'SIMULATED DEMO OUTCOME' : 'Gateway execution outcome.', { execution_mode: adapter.mode, simulated: adapter.mode === 'DEMO_SIMULATION', label: adapter.mode === 'DEMO_SIMULATION' ? 'SIMULATED DEMO OUTCOME' : undefined });
}
export async function runRecoveryBatch(runName = 'Phase 6 Demo Recovery Batch'): Promise<BatchRunSummary> {
  const adapter = getExecutionAdapter();
  const batch: BatchRun = { id: `batch-${randomUUID()}`, run_name: runName, total_transactions: 0, execution_mode: adapter.mode, status: 'RUNNING', metrics_summary: {}, started_at: new Date().toISOString() };
  inMemoryStore.insertBatchRun(batch);
  recordAuditEvent({ event_type: 'BATCH_STARTED', actor_type: 'SYSTEM', actor_id: 'phase-6-batch-runner', what: 'Batch started.', why: 'Recovery batch requested.', result: 'RUNNING', state_after: { execution_mode: adapter.mode, simulated: adapter.mode === 'DEMO_SIMULATION' } });
  const demoScenarios = new Set(['SAFE_AUTO_RETRY', 'OVER_LIMIT_REVIEW', 'LOW_CONFIDENCE_REVIEW', 'PAYMENT_LINK_RECOVERY', 'FAILED_RECOVERY', 'HIGH_VALUE_RECEIVABLE']);
  const items = inMemoryStore.getTransactions().filter((tx) => pending(tx.status) && tx.demo_scenario && demoScenarios.has(tx.demo_scenario));
  let processed = 0; let processingErrors = 0;
  for (const tx of items) {
    try { if (!attempted(tx.id)) { await processOne(tx); processed++; } }
    catch (error) { processingErrors++; inMemoryStore.updateTransaction(tx.id, { status: 'failed' }); audit('EXECUTION_FAILED', tx, 'FAILED', error instanceof Error ? error.message : 'Unknown error.', { execution_mode: adapter.mode }); }
  }
  const txs = inMemoryStore.getTransactions();
  const reviewedCount = txs.filter((tx) => tx.status === 'review').length;
  const blockedCount = txs.filter((tx) => tx.status === 'blocked').length;
  const recoveredCount = txs.filter((tx) => tx.status === 'recovered').length;
  const failedCount = txs.filter((tx) => tx.status === 'failed').length;
  const recoveredAmount = calculateVerifiedRecovery(inMemoryStore.getRecoveryResults());
  const base = items.reduce((sum, tx) => sum + tx.amount_in_inr, 0);
  const rate = calculateRecoveryRate(recoveredAmount, base);
  const final = inMemoryStore.updateBatchRun(batch.id, { total_transactions: items.length, status: 'COMPLETED', completed_at: new Date().toISOString(), metrics_summary: { processed, recovered: recoveredCount, failed: failedCount, processing_errors: processingErrors, reviewed: reviewedCount, blocked: blockedCount, recovered_amount_in_inr: recoveredAmount, recovery_rate: rate, execution_mode: adapter.mode, simulated: adapter.mode === 'DEMO_SIMULATION', label: adapter.mode === 'DEMO_SIMULATION' ? 'SIMULATED DEMO OUTCOME' : undefined } })!;
  recordAuditEvent({ event_type: 'BATCH_COMPLETED', actor_type: 'SYSTEM', actor_id: 'phase-6-batch-runner', what: 'Batch completed.', why: 'All pending transactions were processed independently.', result: 'COMPLETED', state_after: final.metrics_summary });
  return { batch: final, processed, recovered: recoveredCount, failed: failedCount, reviewed: reviewedCount, blocked: blockedCount, recovered_amount_in_inr: recoveredAmount, recovery_rate: rate };
}
