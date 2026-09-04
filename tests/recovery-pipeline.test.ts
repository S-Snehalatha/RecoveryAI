import { beforeEach, describe, expect, it } from 'vitest';
import { runRecoveryBatch } from '../src/lib/recovery/batchRunner';
import { evaluatePolicy } from '../src/lib/policy';
import { inMemoryStore } from '../src/lib/db/inMemoryStore';

describe('RecoverAI — Phase 6 end-to-end recovery pipeline', () => {
  beforeEach(() => {
    inMemoryStore.reset();
    const scenarios = new Set(['SAFE_AUTO_RETRY', 'OVER_LIMIT_REVIEW', 'LOW_CONFIDENCE_REVIEW', 'PAYMENT_LINK_RECOVERY', 'FAILED_RECOVERY', 'HIGH_VALUE_RECEIVABLE']);
    inMemoryStore.getTransactions().filter((tx) => tx.demo_scenario && scenarios.has(tx.demo_scenario)).forEach((tx) => inMemoryStore.updateTransaction(tx.id, { status: 'pending' }));
  });

  it('processes the deterministic demo scenarios end-to-end', async () => {
    const result = await runRecoveryBatch();
    expect(result.batch.execution_mode).toBe('DEMO_SIMULATION');
    expect(result.batch.status).toBe('COMPLETED');
    expect(result.processed).toBe(6);
    // Only the auto-retry scenario is immediately, verifiably recovered.
    // The payment-link scenario dispatched a link successfully but has NOT
    // been recovered yet — a Payment Link creation is an ATTEMPT, not
    // recovered revenue, until a later confirmation event verifies it.
    expect(result.recovered).toBe(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.reviewed).toBeGreaterThanOrEqual(3);
    expect(inMemoryStore.getRecoveryAttempts().every((a) => a.execution_mode === 'DEMO_SIMULATION')).toBe(true);
    expect(inMemoryStore.getRecoveryResults().every((r) => r.verification_source === 'SIMULATION_EVENT')).toBe(true);
    expect(inMemoryStore.getAuditLogs().some((a) => a.action_type === 'BATCH_COMPLETED')).toBe(true);

    // The payment-link attempt itself must exist (money was NOT left untouched)...
    const linkTx = inMemoryStore.getTransactions().find((tx) => tx.demo_scenario === 'PAYMENT_LINK_RECOVERY')!;
    const linkAttempt = inMemoryStore.getRecoveryAttempts(linkTx.id)[0];
    expect(linkAttempt).toBeDefined();
    expect(linkAttempt?.status).toBe('DISPATCHED');
    // ...but must NOT have a RecoveryResult yet (no result = not recovered).
    expect(inMemoryStore.getRecoveryResults(linkTx.id).length).toBe(0);
    // And the transaction itself must still be sitting in 'executing', not
    // silently and incorrectly marked 'recovered'.
    expect(inMemoryStore.getTransactions().find((tx) => tx.id === linkTx.id)?.status).toBe('executing');
  });

  it('does not duplicate recovery when the batch is run twice', async () => {
    await runRecoveryBatch();
    const attemptsAfterFirst = inMemoryStore.getRecoveryAttempts().length;
    const resultsAfterFirst = inMemoryStore.getRecoveryResults().length;
    const second = await runRecoveryBatch();
    expect(second.batch.total_transactions).toBe(0);
    expect(inMemoryStore.getRecoveryAttempts().length).toBe(attemptsAfterFirst);
    expect(inMemoryStore.getRecoveryResults().length).toBe(resultsAfterFirst);
  });

  it('keeps an over-limit retry out of automatic execution', () => {
    const tx = inMemoryStore.getTransactions().find((item) => item.demo_scenario === 'OVER_LIMIT_REVIEW')!;
    const decision = evaluatePolicy(tx, { recommended_strategy: 'retry_payment', confidence_score: 0.95 });
    expect(decision.decision).toBe('HUMAN_REVIEW');
    expect(decision.rule_id).toBe('PAYMENT_RETRY_LIMIT');
  });
});
