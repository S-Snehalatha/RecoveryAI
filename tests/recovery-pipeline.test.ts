import { beforeEach, describe, expect, it } from 'vitest';
import { runRecoveryBatch } from '../src/lib/recovery/batchRunner';
import { evaluatePolicy } from '../src/lib/policy';
import { inMemoryStore } from '../src/lib/db/inMemoryStore';

describe('RecoverAI — Phase 9 agent approval-gated recovery pipeline', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  it('analyzes at-risk transactions but never executes recovery without human approval', async () => {
    const result = await runRecoveryBatch();

    expect(result.batch.execution_mode).toBe('DEMO_SIMULATION');
    expect(result.batch.status).toBe('COMPLETED');
    expect(result.processed).toBeGreaterThan(0);
    expect(result.recovered).toBe(1);
    expect(result.batch.metrics_summary.actions_executed).toBe(0);
    expect(result.batch.metrics_summary.approval_required).toBe(true);

    const pendingReviews = inMemoryStore.getHumanReviews('PENDING');
    expect(pendingReviews.length).toBeGreaterThan(0);

    // The agent must stop before creating a new recovery attempt.
    expect(inMemoryStore.getRecoveryAttempts().length).toBe(1);

    const safeTx = inMemoryStore.getTransactions().find((tx) => tx.demo_scenario === 'SAFE_AUTO_RETRY')!;
    expect(safeTx.status).toBe('review');
    expect(inMemoryStore.getRecoveryAttempts(safeTx.id).length).toBe(0);

    // Existing verified demo revenue remains valid evidence; the agent did not
    // count a new recovery during this analysis-only batch.
    expect(result.recovered_amount_in_inr).toBeGreaterThan(0);
  });

  it('does not duplicate analysis requests when the batch is run twice', async () => {
    await runRecoveryBatch();
    const attemptsAfterFirst = inMemoryStore.getRecoveryAttempts().length;
    const decisionsAfterFirst = inMemoryStore.getAIDecisions().length;
    const reviewsAfterFirst = inMemoryStore.getHumanReviews().length;

    const second = await runRecoveryBatch();

    expect(second.batch.total_transactions).toBe(0);
    expect(inMemoryStore.getRecoveryAttempts().length).toBe(attemptsAfterFirst);
    expect(inMemoryStore.getAIDecisions().length).toBe(decisionsAfterFirst);
    expect(inMemoryStore.getHumanReviews().length).toBe(reviewsAfterFirst);
  });

  it('keeps an over-limit retry out of automatic execution', () => {
    const tx = inMemoryStore.getTransactions().find((item) => item.demo_scenario === 'OVER_LIMIT_REVIEW')!;
    const decision = evaluatePolicy(tx, { recommended_strategy: 'retry_payment', confidence_score: 0.95 });
    expect(decision.decision).toBe('HUMAN_REVIEW');
    expect(decision.rule_id).toBe('PAYMENT_RETRY_LIMIT');
  });
});
