import { describe, it, expect } from 'vitest';
import { evaluatePolicy, POLICY_THRESHOLDS, PolicyAIInput } from '../src/lib/policy';
import { Transaction } from '../src/types';

/**
 * Builds a minimally-valid Transaction with sensible defaults, allowing each
 * test to override only the fields relevant to the rule under test.
 */
function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-test-0001',
    original_reference_id: 'pay_test_0001',
    loss_type: 'failed_payment',
    amount_in_inr: 1000,
    currency: 'INR',
    customer_id: 'cust-0001',
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    customer_phone: '+919999999999',
    customer_tier: 'STANDARD',
    customer_ltv_inr: 10000,
    customer_tenure_days: 100,
    payment_method: 'card',
    attempt_count: 1,
    previous_successful_payments: 0,
    experiment_group: 'AI_RECOVERY_GROUP',
    status: 'DIAGNOSED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAIInput(overrides: Partial<PolicyAIInput> = {}): PolicyAIInput {
  return {
    recommended_strategy: 'retry_payment',
    confidence_score: 0.75,
    ...overrides,
  };
}

describe('RecoverAI — Deterministic Policy Engine (Phase 4)', () => {
  describe('RULE 1: retry_payment — amount <= 5000 AND attempt_count <= 2 AND confidence >= 0.60', () => {
    it('ALLOWs at exactly the amount boundary (₹5,000)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 5000, attempt_count: 1 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.75 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('PAYMENT_RETRY_LIMIT');
      expect(result.requires_human).toBe(false);
    });

    it('routes to HUMAN_REVIEW just past the amount boundary (₹5,001)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 5001, attempt_count: 1 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.75 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('PAYMENT_RETRY_LIMIT');
      expect(result.requires_human).toBe(true);
    });

    it('ALLOWs at exactly the attempt_count boundary (2)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 2000, attempt_count: 2 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.75 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('PAYMENT_RETRY_LIMIT');
    });

    it('routes to HUMAN_REVIEW just past the attempt_count boundary (3)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 2000, attempt_count: 3 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.75 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('PAYMENT_RETRY_LIMIT');
    });
  });

  describe('RULE 2: send_payment_link — amount <= 25000 AND confidence >= 0.60', () => {
    it('ALLOWs at exactly the amount boundary (₹25,000)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 25000, loss_type: 'abandoned_checkout' }),
        makeAIInput({ recommended_strategy: 'send_payment_link', confidence_score: 0.7 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('PAYMENT_LINK_LIMIT');
      expect(result.requires_human).toBe(false);
    });

    it('routes to HUMAN_REVIEW just past the amount boundary (₹25,001)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 25001, loss_type: 'abandoned_checkout' }),
        makeAIInput({ recommended_strategy: 'send_payment_link', confidence_score: 0.7 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('PAYMENT_LINK_LIMIT');
      expect(result.requires_human).toBe(true);
    });
  });

  describe('RULE 3: retry_mandate — previous_successful_payments >= 3 AND confidence >= 0.60', () => {
    it('ALLOWs at exactly the boundary (3 prior successful payments)', () => {
      const result = evaluatePolicy(
        makeTransaction({ loss_type: 'subscription_failure', previous_successful_payments: 3 }),
        makeAIInput({ recommended_strategy: 'retry_mandate', confidence_score: 0.8 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('MANDATE_RETRY_ELIGIBILITY');
      expect(result.requires_human).toBe(false);
    });

    it('routes to HUMAN_REVIEW just below the boundary (2 prior successful payments)', () => {
      const result = evaluatePolicy(
        makeTransaction({ loss_type: 'subscription_failure', previous_successful_payments: 2 }),
        makeAIInput({ recommended_strategy: 'retry_mandate', confidence_score: 0.8 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('MANDATE_RETRY_ELIGIBILITY');
      expect(result.requires_human).toBe(true);
    });
  });

  describe('RULE 4: overdue receivable above ₹50,000 → HUMAN_REVIEW', () => {
    it('ALLOWs escalate_receivables at exactly the boundary (₹50,000)', () => {
      const result = evaluatePolicy(
        makeTransaction({ loss_type: 'overdue_receivable', amount_in_inr: 50000 }),
        makeAIInput({ recommended_strategy: 'escalate_receivables', confidence_score: 0.8 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('RECEIVABLE_ESCALATION_ALLOWED');
      expect(result.requires_human).toBe(false);
    });

    it('routes to HUMAN_REVIEW just past the boundary (₹50,001)', () => {
      const result = evaluatePolicy(
        makeTransaction({ loss_type: 'overdue_receivable', amount_in_inr: 50001 }),
        makeAIInput({ recommended_strategy: 'escalate_receivables', confidence_score: 0.8 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('RECEIVABLE_OVER_LIMIT');
      expect(result.requires_human).toBe(true);
    });

    it('forces HUMAN_REVIEW above the boundary even with a maximally confident AI', () => {
      const result = evaluatePolicy(
        makeTransaction({ loss_type: 'overdue_receivable', amount_in_inr: 250000 }),
        makeAIInput({ recommended_strategy: 'escalate_receivables', confidence_score: 0.99 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('RECEIVABLE_OVER_LIMIT');
    });
  });

  describe('RULE 5: confidence < 0.60 → HUMAN_REVIEW (checked before strategy-specific limits)', () => {
    it('ALLOWs at exactly the confidence boundary (0.60)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 1000, attempt_count: 1 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.6 })
      );
      expect(result.decision).toBe('ALLOW');
    });

    it('routes to HUMAN_REVIEW just below the confidence boundary (0.59)', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 1000, attempt_count: 1 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.59 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('LOW_CONFIDENCE_REVIEW');
      expect(result.requires_human).toBe(true);
    });

    it('low confidence overrides an otherwise well within limits transaction', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 100, attempt_count: 1 }),
        makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.1 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('LOW_CONFIDENCE_REVIEW');
    });
  });

  describe('RULE 6: refund strategies are never allowed', () => {
    it('BLOCKs a "refund" recommendation outright, regardless of confidence', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 100 }),
        makeAIInput({ recommended_strategy: 'refund', confidence_score: 0.99 })
      );
      expect(result.decision).toBe('BLOCK');
      expect(result.rule_id).toBe('REFUND_NEVER_ALLOWED');
      expect(result.requires_human).toBe(true);
    });

    it('BLOCKs an "auto_refund" recommendation outright', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 100 }),
        makeAIInput({ recommended_strategy: 'auto_refund', confidence_score: 0.99 })
      );
      expect(result.decision).toBe('BLOCK');
      expect(result.rule_id).toBe('REFUND_NEVER_ALLOWED');
    });

    it('BLOCKs a "credit_note" recommendation outright', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 100 }),
        makeAIInput({ recommended_strategy: 'credit_note', confidence_score: 0.99 })
      );
      expect(result.decision).toBe('BLOCK');
      expect(result.rule_id).toBe('REFUND_NEVER_ALLOWED');
    });

    it('is case-insensitive to refund-shaped strategy strings', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 100 }),
        makeAIInput({ recommended_strategy: 'REFUND', confidence_score: 0.99 })
      );
      expect(result.decision).toBe('BLOCK');
      expect(result.rule_id).toBe('REFUND_NEVER_ALLOWED');
    });
  });

  describe('Defense-in-depth: unapproved/unknown strategy strings', () => {
    it('BLOCKs a strategy that is not in the approved enum, even with high confidence', () => {
      const result = evaluatePolicy(
        makeTransaction({ amount_in_inr: 100 }),
        makeAIInput({ recommended_strategy: 'transfer_funds', confidence_score: 0.99 })
      );
      expect(result.decision).toBe('BLOCK');
      expect(result.rule_id).toBe('UNKNOWN_STRATEGY_BLOCKED');
      expect(result.requires_human).toBe(true);
    });
  });

  describe('Pass-through strategies: no_action, human_review, escalate_receivables under limit', () => {
    it('ALLOWs no_action when confidence is sufficient', () => {
      const result = evaluatePolicy(
        makeTransaction(),
        makeAIInput({ recommended_strategy: 'no_action', confidence_score: 0.95 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('NO_ACTION_ALLOWED');
      expect(result.requires_human).toBe(false);
    });

    it('routes to HUMAN_REVIEW when the AI itself recommends human_review', () => {
      const result = evaluatePolicy(
        makeTransaction(),
        makeAIInput({ recommended_strategy: 'human_review', confidence_score: 0.9 })
      );
      expect(result.decision).toBe('HUMAN_REVIEW');
      expect(result.rule_id).toBe('AI_REQUESTED_HUMAN_REVIEW');
      expect(result.requires_human).toBe(true);
    });

    it('ALLOWs escalate_receivables for a non-overdue-receivable loss_type within any amount', () => {
      const result = evaluatePolicy(
        makeTransaction({ loss_type: 'overdue_receivable', amount_in_inr: 1000 }),
        makeAIInput({ recommended_strategy: 'escalate_receivables', confidence_score: 0.8 })
      );
      expect(result.decision).toBe('ALLOW');
      expect(result.rule_id).toBe('RECEIVABLE_ESCALATION_ALLOWED');
    });
  });

  describe('Determinism', () => {
    it('produces identical output for identical input across repeated calls', () => {
      const tx = makeTransaction({ amount_in_inr: 3000, attempt_count: 1 });
      const ai = makeAIInput({ recommended_strategy: 'retry_payment', confidence_score: 0.7 });

      const first = evaluatePolicy(tx, ai);
      const second = evaluatePolicy(tx, ai);
      const third = evaluatePolicy(tx, ai);

      expect(first).toEqual(second);
      expect(second).toEqual(third);
    });
  });

  describe('Thresholds are the single source of truth', () => {
    it('exposes the exact numeric thresholds used by the rules', () => {
      expect(POLICY_THRESHOLDS.CONFIDENCE_MIN).toBe(0.6);
      expect(POLICY_THRESHOLDS.RETRY_PAYMENT_MAX_AMOUNT_INR).toBe(5000);
      expect(POLICY_THRESHOLDS.RETRY_PAYMENT_MAX_ATTEMPTS).toBe(2);
      expect(POLICY_THRESHOLDS.PAYMENT_LINK_MAX_AMOUNT_INR).toBe(25000);
      expect(POLICY_THRESHOLDS.MANDATE_MIN_PREVIOUS_SUCCESSFUL_PAYMENTS).toBe(3);
      expect(POLICY_THRESHOLDS.RECEIVABLE_HUMAN_REVIEW_THRESHOLD_INR).toBe(50000);
    });
  });
});
