import { describe, it, expect } from 'vitest';
import { calculateRevenueAtRisk } from '../src/lib/metrics/revenueAtRisk';
import { calculateRecoveryAttempted } from '../src/lib/metrics/recoveryAttempted';
import { calculateVerifiedRecovery } from '../src/lib/metrics/verifiedRecovery';
import { calculateRecoveryRate } from '../src/lib/metrics/recoveryRate';
import { compareControlGroups } from '../src/lib/metrics/controlGroup';
import { calculateIncrementalRecovery } from '../src/lib/metrics/incrementalRecovery';
import { makeTransaction, makeRecoveryAttempt, makeRecoveryResult, makeControlGroupRecord } from './helpers/factories';

describe('RecoverAI — Revenue Measurement Services (Phase 5)', () => {
  describe('1. calculateRevenueAtRisk', () => {
    it('sums the amount of every at-risk transaction', () => {
      const txs = [
        makeTransaction({ amount_in_inr: 1000 }),
        makeTransaction({ amount_in_inr: 2500 }),
        makeTransaction({ amount_in_inr: 500 }),
      ];
      expect(calculateRevenueAtRisk(txs)).toBe(4000);
    });

    it('returns 0 for an empty transaction list', () => {
      expect(calculateRevenueAtRisk([])).toBe(0);
    });

    it('never double-counts the same transaction id if it appears twice in the input', () => {
      const tx = makeTransaction({ id: 'tx-dup-1', amount_in_inr: 3000 });
      expect(calculateRevenueAtRisk([tx, tx])).toBe(3000);
    });

    it('filters to a single experiment group when requested', () => {
      const txs = [
        makeTransaction({ amount_in_inr: 1000, experiment_group: 'AI_RECOVERY_GROUP' }),
        makeTransaction({ amount_in_inr: 5000, experiment_group: 'CONTROL_GROUP' }),
      ];
      expect(calculateRevenueAtRisk(txs, { experimentGroup: 'AI_RECOVERY_GROUP' })).toBe(1000);
      expect(calculateRevenueAtRisk(txs, { experimentGroup: 'CONTROL_GROUP' })).toBe(5000);
    });

    it('does NOT count money based on an AI recommendation alone — only real transactions', () => {
      // Sanity check on the definition: this function only ever sees Transaction
      // records, never AIDecision records, so a recommendation can never inflate
      // revenue-at-risk on its own.
      const tx = makeTransaction({ amount_in_inr: 750 });
      expect(calculateRevenueAtRisk([tx])).toBe(750);
    });
  });

  describe('2. calculateRecoveryAttempted', () => {
    it('counts a transaction with a dispatched attempt', () => {
      const tx = makeTransaction({ id: 'tx-a', amount_in_inr: 2000 });
      const attempt = makeRecoveryAttempt({ transaction_id: 'tx-a', status: 'DISPATCHED' });
      expect(calculateRecoveryAttempted([tx], [attempt])).toBe(2000);
    });

    it('does NOT count a transaction whose only attempt is still PENDING (not yet initiated)', () => {
      const tx = makeTransaction({ id: 'tx-b', amount_in_inr: 2000 });
      const attempt = makeRecoveryAttempt({ transaction_id: 'tx-b', status: 'PENDING' });
      expect(calculateRecoveryAttempted([tx], [attempt])).toBe(0);
    });

    it('counts a transaction retried multiple times exactly once, not once per attempt', () => {
      const tx = makeTransaction({ id: 'tx-c', amount_in_inr: 1500 });
      const attempts = [
        makeRecoveryAttempt({ transaction_id: 'tx-c', status: 'DISPATCHED' }),
        makeRecoveryAttempt({ transaction_id: 'tx-c', status: 'FAILED' }),
        makeRecoveryAttempt({ transaction_id: 'tx-c', status: 'SUCCEEDED' }),
      ];
      expect(calculateRecoveryAttempted([tx], attempts)).toBe(1500);
    });

    it('counts a FAILED or EXPIRED or CANCELLED attempt as still "attempted" (the intervention was initiated)', () => {
      const tx = makeTransaction({ id: 'tx-d', amount_in_inr: 900 });
      expect(calculateRecoveryAttempted([tx], [makeRecoveryAttempt({ transaction_id: 'tx-d', status: 'FAILED' })])).toBe(900);
      expect(calculateRecoveryAttempted([tx], [makeRecoveryAttempt({ transaction_id: 'tx-d', status: 'EXPIRED' })])).toBe(900);
      expect(calculateRecoveryAttempted([tx], [makeRecoveryAttempt({ transaction_id: 'tx-d', status: 'CANCELLED' })])).toBe(900);
    });

    it('a recommendation alone (no RecoveryAttempt record at all) is NOT an attempt', () => {
      const tx = makeTransaction({ id: 'tx-e', amount_in_inr: 4000 });
      expect(calculateRecoveryAttempted([tx], [])).toBe(0);
    });

    it('ignores attempts referencing a transaction id not present in the transaction list', () => {
      const tx = makeTransaction({ id: 'tx-f', amount_in_inr: 1200 });
      const orphanAttempt = makeRecoveryAttempt({ transaction_id: 'tx-does-not-exist', status: 'DISPATCHED' });
      expect(calculateRecoveryAttempted([tx], [orphanAttempt])).toBe(0);
    });
  });

  describe('3. calculateVerifiedRecovery', () => {
    it('sums only results with a VERIFIED_RECOVERED outcome', () => {
      const results = [
        makeRecoveryResult({ transaction_id: 'tx-1', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 1000 }),
        makeRecoveryResult({ transaction_id: 'tx-2', outcome_status: 'FAILED', recovered_amount_in_inr: 500 }),
        makeRecoveryResult({ transaction_id: 'tx-3', outcome_status: 'UNRESOLVED', recovered_amount_in_inr: 300 }),
      ];
      expect(calculateVerifiedRecovery(results)).toBe(1000);
    });

    it('a Payment Link creation alone (no VERIFIED_RECOVERED result) is NOT recovered revenue', () => {
      // Simulates: an attempt was dispatched, but no RecoveryResult exists yet.
      expect(calculateVerifiedRecovery([])).toBe(0);
    });

    it('CRITICAL: duplicate recovery events for the same transaction are never double-counted', () => {
      // Simulates a gateway webhook firing twice for the same payment
      // (at-least-once delivery / retried webhook).
      const duplicateEvents = [
        makeRecoveryResult({ transaction_id: 'tx-dup', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 5000 }),
        makeRecoveryResult({ transaction_id: 'tx-dup', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 5000 }),
        makeRecoveryResult({ transaction_id: 'tx-dup', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 5000 }),
      ];
      expect(calculateVerifiedRecovery(duplicateEvents)).toBe(5000);
    });

    it('still counts distinct transactions independently even when one of them has duplicates', () => {
      const results = [
        makeRecoveryResult({ transaction_id: 'tx-x', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 2000 }),
        makeRecoveryResult({ transaction_id: 'tx-x', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 2000 }), // duplicate
        makeRecoveryResult({ transaction_id: 'tx-y', outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: 750 }),
      ];
      expect(calculateVerifiedRecovery(results)).toBe(2750);
    });
  });

  describe('4. calculateRecoveryRate', () => {
    it('computes recovered / at-risk as a ratio in [0, 1]', () => {
      expect(calculateRecoveryRate(2500, 10000)).toBe(0.25);
    });

    it('returns 0 when at-risk amount is zero (no division by zero / NaN)', () => {
      expect(calculateRecoveryRate(0, 0)).toBe(0);
      expect(calculateRecoveryRate(500, 0)).toBe(0);
    });

    it('returns 0 for a negative or non-finite base amount', () => {
      expect(calculateRecoveryRate(100, -500)).toBe(0);
      expect(calculateRecoveryRate(100, Number.NaN)).toBe(0);
    });

    it('returns 0 for a negative recovered amount (defensive)', () => {
      expect(calculateRecoveryRate(-100, 1000)).toBe(0);
    });
  });

  describe('5. compareControlGroups', () => {
    it('keeps AI-group and control-group figures completely separate', () => {
      const aiTx = makeTransaction({ id: 'ai-tx-1', amount_in_inr: 10000, experiment_group: 'AI_RECOVERY_GROUP' });
      const controlTx = makeTransaction({ id: 'ctrl-tx-1', amount_in_inr: 10000, experiment_group: 'CONTROL_GROUP' });

      const aiResult = makeRecoveryResult({
        transaction_id: 'ai-tx-1',
        outcome_status: 'VERIFIED_RECOVERED',
        recovered_amount_in_inr: 4000,
      });
      const controlBaseline = makeControlGroupRecord({
        transaction_id: 'ctrl-tx-1',
        baseline_outcome: 'VERIFIED_RECOVERED',
        baseline_recovered_amount: 1000,
      });

      const comparison = compareControlGroups([aiTx, controlTx], [aiResult], [controlBaseline]);

      expect(comparison.aiGroup.group).toBe('AI_RECOVERY_GROUP');
      expect(comparison.aiGroup.revenueAtRiskInr).toBe(10000);
      expect(comparison.aiGroup.recoveredAmountInr).toBe(4000);
      expect(comparison.aiGroup.recoveryRate).toBe(0.4);

      expect(comparison.controlGroup.group).toBe('CONTROL_GROUP');
      expect(comparison.controlGroup.revenueAtRiskInr).toBe(10000);
      expect(comparison.controlGroup.recoveredAmountInr).toBe(1000);
      expect(comparison.controlGroup.recoveryRate).toBe(0.1);
    });

    it('never lets a control-group RecoveryResult (there should be none) leak into the AI figure', () => {
      // Even if a RecoveryResult happens to reference a control-group transaction id
      // (which should not occur in practice), it must not be attributed to the AI group.
      const aiTx = makeTransaction({ id: 'ai-tx-2', amount_in_inr: 5000, experiment_group: 'AI_RECOVERY_GROUP' });
      const controlTx = makeTransaction({ id: 'ctrl-tx-2', amount_in_inr: 5000, experiment_group: 'CONTROL_GROUP' });
      const strayResult = makeRecoveryResult({
        transaction_id: 'ctrl-tx-2',
        outcome_status: 'VERIFIED_RECOVERED',
        recovered_amount_in_inr: 5000,
      });

      const comparison = compareControlGroups([aiTx, controlTx], [strayResult], []);

      expect(comparison.aiGroup.recoveredAmountInr).toBe(0);
      expect(comparison.controlGroup.recoveredAmountInr).toBe(0); // control uses ControlGroupRecord, not RecoveryResult
    });

    it('handles an empty control group without dividing by zero', () => {
      const comparison = compareControlGroups([], [], []);
      expect(comparison.aiGroup.recoveryRate).toBe(0);
      expect(comparison.controlGroup.recoveryRate).toBe(0);
    });
  });

  describe('6. calculateIncrementalRecovery', () => {
    it('computes a positive lift when the AI group outperforms the control-rate baseline', () => {
      const aiTx = makeTransaction({ id: 'ai-lift-1', amount_in_inr: 10000, experiment_group: 'AI_RECOVERY_GROUP' });
      const controlTx = makeTransaction({ id: 'ctrl-lift-1', amount_in_inr: 10000, experiment_group: 'CONTROL_GROUP' });

      const aiResult = makeRecoveryResult({
        transaction_id: 'ai-lift-1',
        outcome_status: 'VERIFIED_RECOVERED',
        recovered_amount_in_inr: 4000, // 40% AI recovery rate
      });
      const controlBaseline = makeControlGroupRecord({
        transaction_id: 'ctrl-lift-1',
        baseline_outcome: 'VERIFIED_RECOVERED',
        baseline_recovered_amount: 1000, // 10% control recovery rate
      });

      const comparison = compareControlGroups([aiTx, controlTx], [aiResult], [controlBaseline]);
      const incremental = calculateIncrementalRecovery(comparison.aiGroup, comparison.controlGroup);

      // Expected recovery at control rate: 10% of ₹10,000 = ₹1,000
      expect(incremental.expectedRecoveryAtControlRateInr).toBe(1000);
      // Incremental: ₹4,000 actual - ₹1,000 expected = ₹3,000
      expect(incremental.incrementalRecoveredAmountInr).toBe(3000);
      expect(incremental.recoveryRateLift).toBeCloseTo(0.3, 10);
    });

    it('computes a negative lift when the AI group underperforms the control-rate baseline', () => {
      const aiTx = makeTransaction({ id: 'ai-lift-2', amount_in_inr: 10000, experiment_group: 'AI_RECOVERY_GROUP' });
      const controlTx = makeTransaction({ id: 'ctrl-lift-2', amount_in_inr: 10000, experiment_group: 'CONTROL_GROUP' });

      const aiResult = makeRecoveryResult({
        transaction_id: 'ai-lift-2',
        outcome_status: 'VERIFIED_RECOVERED',
        recovered_amount_in_inr: 500, // 5% AI recovery rate
      });
      const controlBaseline = makeControlGroupRecord({
        transaction_id: 'ctrl-lift-2',
        baseline_outcome: 'VERIFIED_RECOVERED',
        baseline_recovered_amount: 2000, // 20% control recovery rate
      });

      const comparison = compareControlGroups([aiTx, controlTx], [aiResult], [controlBaseline]);
      const incremental = calculateIncrementalRecovery(comparison.aiGroup, comparison.controlGroup);

      expect(incremental.incrementalRecoveredAmountInr).toBeLessThan(0);
    });

    it('never claims statistical significance — always carries a disclaimer note', () => {
      const aiTx = makeTransaction({ id: 'ai-lift-3', amount_in_inr: 1000, experiment_group: 'AI_RECOVERY_GROUP' });
      const controlTx = makeTransaction({ id: 'ctrl-lift-3', amount_in_inr: 1000, experiment_group: 'CONTROL_GROUP' });
      const comparison = compareControlGroups([aiTx, controlTx], [], []);
      const incremental = calculateIncrementalRecovery(comparison.aiGroup, comparison.controlGroup);

      expect(incremental.note).toBeTruthy();
      // The disclaimer should explicitly warn against treating this as a proven,
      // statistically-significant result — not silently omit that caveat.
      expect(incremental.note.toLowerCase()).toMatch(/no statistical significance|not.*proven|do not report.*proven/);
    });

    it('reports sample sizes alongside the lift so the reader can judge how much to trust it', () => {
      const aiTx = makeTransaction({ id: 'ai-lift-4', amount_in_inr: 1000, experiment_group: 'AI_RECOVERY_GROUP' });
      const comparison = compareControlGroups([aiTx], [], []);
      const incremental = calculateIncrementalRecovery(comparison.aiGroup, comparison.controlGroup);

      expect(incremental.sampleSizes.aiGroupTransactions).toBe(1);
      expect(incremental.sampleSizes.controlGroupTransactions).toBe(0);
    });
  });
});
