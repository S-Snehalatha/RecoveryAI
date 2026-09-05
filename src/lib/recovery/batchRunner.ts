import { randomUUID } from 'crypto';
import { runRecoveryAgent } from '@/lib/agent/runner';
import { recordAuditEvent } from '@/lib/audit';
import { calculateRecoveryRate, calculateVerifiedRecovery } from '@/lib/metrics';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { getExecutionAdapter } from '@/lib/razorpay/adapter';
import { BatchRun, Transaction } from '@/types';

export interface BatchRunSummary {
  batch: BatchRun;
  processed: number;
  recovered: number;
  failed: number;
  reviewed: number;
  blocked: number;
  recovered_amount_in_inr: number;
  recovery_rate: number;
}

const pending = (status: Transaction['status']) => status === 'pending' || status === 'INGESTED';

function attempted(transactionId: string): boolean {
  return inMemoryStore.getRecoveryAttempts(transactionId).length > 0;
}

/**
 * Phase 9 batch behavior: the agent may analyze every at-risk transaction,
 * but it must stop at a human authorization gate. No recovery action is
 * executed from this batch runner.
 */
export async function runRecoveryBatch(runName = 'Agent Analysis Batch'): Promise<BatchRunSummary> {
  const adapter = getExecutionAdapter();
  const batch: BatchRun = {
    id: `batch-${randomUUID()}`,
    run_name: runName,
    total_transactions: 0,
    execution_mode: adapter.mode,
    status: 'RUNNING',
    metrics_summary: {},
    started_at: new Date().toISOString(),
  };

  inMemoryStore.insertBatchRun(batch);
  recordAuditEvent({
    event_type: 'BATCH_STARTED',
    actor_type: 'SYSTEM',
    actor_id: 'recovery-agent',
    what: 'Agent analysis batch started.',
    why: 'RecoverAI was asked to inspect pending at-risk transactions.',
    result: 'RUNNING',
    state_after: { execution_mode: adapter.mode, approval_required: true },
  });

  const items = inMemoryStore
    .getTransactions()
    .filter((tx) => pending(tx.status) && !attempted(tx.id));

  let processed = 0;
  let processingErrors = 0;

  for (const tx of items) {
    try {
      await runRecoveryAgent(tx);
      processed++;
    } catch (error) {
      processingErrors++;
      inMemoryStore.updateTransaction(tx.id, { status: 'failed' });
      recordAuditEvent({
        event_type: 'EXECUTION_FAILED',
        actor_type: 'SYSTEM',
        actor_id: 'recovery-agent',
        transaction_id: tx.id,
        what: 'Agent analysis failed before an approval request could be created.',
        why: error instanceof Error ? error.message : 'Unknown agent analysis error.',
        result: 'FAILED',
        amount_in_inr: tx.amount_in_inr,
      });
    }
  }

  const transactions = inMemoryStore.getTransactions();
  const reviewedCount = transactions.filter((tx) => tx.status === 'review' || tx.status === 'NEEDS_HUMAN_REVIEW').length;
  const blockedCount = transactions.filter((tx) => tx.status === 'blocked').length;
  const recoveredCount = transactions.filter((tx) => tx.status === 'recovered').length;
  const failedCount = transactions.filter((tx) => tx.status === 'failed').length;
  const recoveredAmount = calculateVerifiedRecovery(inMemoryStore.getRecoveryResults());
  const base = items.reduce((sum, tx) => sum + tx.amount_in_inr, 0);
  const recoveryRate = calculateRecoveryRate(recoveredAmount, base);

  const final = inMemoryStore.updateBatchRun(batch.id, {
    total_transactions: items.length,
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    metrics_summary: {
      processed,
      recovered: recoveredCount,
      failed: failedCount,
      processing_errors: processingErrors,
      reviewed: reviewedCount,
      blocked: blockedCount,
      recovered_amount_in_inr: recoveredAmount,
      recovery_rate: recoveryRate,
      execution_mode: adapter.mode,
      approval_required: true,
      actions_executed: 0,
    },
  })!;

  recordAuditEvent({
    event_type: 'BATCH_COMPLETED',
    actor_type: 'SYSTEM',
    actor_id: 'recovery-agent',
    what: 'Agent analysis batch completed.',
    why: 'All eligible transactions were analyzed and paused for authorization.',
    result: 'COMPLETED',
    state_after: final.metrics_summary,
  });

  return {
    batch: final,
    processed,
    recovered: recoveredCount,
    failed: failedCount,
    reviewed: reviewedCount,
    blocked: blockedCount,
    recovered_amount_in_inr: recoveredAmount,
    recovery_rate: recoveryRate,
  };
}
