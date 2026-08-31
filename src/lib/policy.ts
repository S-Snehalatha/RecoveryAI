import { Transaction, PolicyDecision, AIStrategy } from '@/types';

/**
 * RecoverAI Deterministic Policy Engine (Phase 4)
 * ------------------------------------------------
 * This module is the SOLE source of truth for whether a recovery strategy
 * is allowed to execute. It contains NO calls to any LLM or external
 * service and produces the same output every time for the same input.
 *
 * Design invariants (do not weaken these without updating the boundary tests):
 * 1. The AI only ever RECOMMENDS a strategy — it has no ability to approve
 *    its own recommendation. Every recommendation must pass through
 *    `evaluatePolicy` before it can be executed.
 * 2. Refund-shaped strategies are permanently and unconditionally blocked,
 *    even if they somehow bypass upstream AI schema validation.
 * 3. Any strategy string outside the approved enum is blocked outright
 *    (defense-in-depth against a corrupted or tampered AI decision object).
 * 4. Nothing in this file may be overridden by the UI or by a user-supplied
 *    parameter. The only way to change these thresholds is to edit this file.
 */

/** Minimal shape of an AI decision the policy engine needs to evaluate. */
export interface PolicyAIInput {
  recommended_strategy: string;
  confidence_score: number;
}

/** Structured output of a single policy evaluation. */
export interface PolicyEvaluation {
  decision: PolicyDecision;
  rule_id: string;
  reason: string;
  requires_human: boolean;
}

// ---- Deterministic thresholds (Phase 4 spec) ----
export const POLICY_THRESHOLDS = {
  CONFIDENCE_MIN: 0.6,
  RETRY_PAYMENT_MAX_AMOUNT_INR: 5000,
  RETRY_PAYMENT_MAX_ATTEMPTS: 2,
  PAYMENT_LINK_MAX_AMOUNT_INR: 25000,
  MANDATE_MIN_PREVIOUS_SUCCESSFUL_PAYMENTS: 3,
  RECEIVABLE_HUMAN_REVIEW_THRESHOLD_INR: 50000,
} as const;

const APPROVED_STRATEGIES: ReadonlySet<AIStrategy> = new Set([
  'retry_payment',
  'send_payment_link',
  'retry_mandate',
  'escalate_receivables',
  'human_review',
  'no_action',
]);

// Any of these (case-insensitive) recommended strategy strings are treated as
// a refund/credit action and are permanently out of scope for automation.
const REFUND_STRATEGY_PATTERNS = ['refund', 'auto_refund', 'credit_note', 'chargeback_reversal', 'issue_refund'];

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Evaluates a transaction + AI decision against the deterministic policy
 * ruleset and returns exactly one of ALLOW / HUMAN_REVIEW / BLOCK.
 *
 * This function is pure: same inputs always produce the same output, no
 * network calls, no randomness, no reliance on wall-clock time.
 */
export function evaluatePolicy(transaction: Transaction, aiDecision: PolicyAIInput): PolicyEvaluation {
  const strategy = aiDecision.recommended_strategy;
  const confidence = aiDecision.confidence_score;

  // RULE 6 — Refunds are never allowed, regardless of confidence, amount,
  // or any other factor. Checked first because it is an absolute hard block.
  if (REFUND_STRATEGY_PATTERNS.includes(strategy.trim().toLowerCase())) {
    return {
      decision: 'BLOCK',
      rule_id: 'REFUND_NEVER_ALLOWED',
      reason: `Strategy "${strategy}" is a refund/credit action, which is permanently out of scope for automated recovery.`,
      requires_human: true,
    };
  }

  // Defense-in-depth: reject any strategy string that isn't one of the six
  // approved strategies, even though upstream Zod validation should already
  // prevent this from occurring in a well-formed AIDecision.
  if (!APPROVED_STRATEGIES.has(strategy as AIStrategy)) {
    return {
      decision: 'BLOCK',
      rule_id: 'UNKNOWN_STRATEGY_BLOCKED',
      reason: `Strategy "${strategy}" is not a recognized, policy-approved strategy.`,
      requires_human: true,
    };
  }

  // RULE 5 — Confidence floor. This is checked before any strategy-specific
  // threshold: an AI that isn't confident enough is never allowed to execute
  // anything, no matter how small the amount is.
  if (confidence < POLICY_THRESHOLDS.CONFIDENCE_MIN) {
    return {
      decision: 'HUMAN_REVIEW',
      rule_id: 'LOW_CONFIDENCE_REVIEW',
      reason: `AI confidence ${confidence.toFixed(2)} is below the required ${POLICY_THRESHOLDS.CONFIDENCE_MIN.toFixed(2)} threshold.`,
      requires_human: true,
    };
  }

  // RULE 4 — High-value overdue receivables always require a human sign-off,
  // independent of which strategy the AI recommended.
  if (
    transaction.loss_type === 'overdue_receivable' &&
    transaction.amount_in_inr > POLICY_THRESHOLDS.RECEIVABLE_HUMAN_REVIEW_THRESHOLD_INR
  ) {
    return {
      decision: 'HUMAN_REVIEW',
      rule_id: 'RECEIVABLE_OVER_LIMIT',
      reason: `Overdue receivable amount ${formatInr(transaction.amount_in_inr)} exceeds the ${formatInr(
        POLICY_THRESHOLDS.RECEIVABLE_HUMAN_REVIEW_THRESHOLD_INR
      )} automated escalation limit.`,
      requires_human: true,
    };
  }

  switch (strategy as AIStrategy) {
    // RULE 1 — retry_payment allowed only if amount <= 5,000 AND
    // attempt_count <= 2 (confidence already checked above).
    case 'retry_payment': {
      const amountOk = transaction.amount_in_inr <= POLICY_THRESHOLDS.RETRY_PAYMENT_MAX_AMOUNT_INR;
      const attemptsOk = transaction.attempt_count <= POLICY_THRESHOLDS.RETRY_PAYMENT_MAX_ATTEMPTS;

      if (amountOk && attemptsOk) {
        return {
          decision: 'ALLOW',
          rule_id: 'PAYMENT_RETRY_LIMIT',
          reason: `Amount ${formatInr(transaction.amount_in_inr)} and attempt count ${transaction.attempt_count} are within automated retry limits.`,
          requires_human: false,
        };
      }
      return {
        decision: 'HUMAN_REVIEW',
        rule_id: 'PAYMENT_RETRY_LIMIT',
        reason: `retry_payment exceeds automated limits (amount <= ${formatInr(
          POLICY_THRESHOLDS.RETRY_PAYMENT_MAX_AMOUNT_INR
        )}, attempts <= ${POLICY_THRESHOLDS.RETRY_PAYMENT_MAX_ATTEMPTS}); amount=${formatInr(
          transaction.amount_in_inr
        )}, attempts=${transaction.attempt_count}.`,
        requires_human: true,
      };
    }

    // RULE 2 — send_payment_link allowed only if amount <= 25,000
    // (confidence already checked above).
    case 'send_payment_link': {
      const amountOk = transaction.amount_in_inr <= POLICY_THRESHOLDS.PAYMENT_LINK_MAX_AMOUNT_INR;

      if (amountOk) {
        return {
          decision: 'ALLOW',
          rule_id: 'PAYMENT_LINK_LIMIT',
          reason: `Amount ${formatInr(transaction.amount_in_inr)} is within the ${formatInr(
            POLICY_THRESHOLDS.PAYMENT_LINK_MAX_AMOUNT_INR
          )} payment link automation limit.`,
          requires_human: false,
        };
      }
      return {
        decision: 'HUMAN_REVIEW',
        rule_id: 'PAYMENT_LINK_LIMIT',
        reason: `send_payment_link exceeds the ${formatInr(
          POLICY_THRESHOLDS.PAYMENT_LINK_MAX_AMOUNT_INR
        )} automation limit; amount=${formatInr(transaction.amount_in_inr)}.`,
        requires_human: true,
      };
    }

    // RULE 3 — retry_mandate allowed only if previous_successful_payments >= 3
    // (confidence already checked above).
    case 'retry_mandate': {
      const historyOk =
        transaction.previous_successful_payments >= POLICY_THRESHOLDS.MANDATE_MIN_PREVIOUS_SUCCESSFUL_PAYMENTS;

      if (historyOk) {
        return {
          decision: 'ALLOW',
          rule_id: 'MANDATE_RETRY_ELIGIBILITY',
          reason: `Customer has ${transaction.previous_successful_payments} prior successful payments, meeting the mandate retry eligibility threshold.`,
          requires_human: false,
        };
      }
      return {
        decision: 'HUMAN_REVIEW',
        rule_id: 'MANDATE_RETRY_ELIGIBILITY',
        reason: `retry_mandate requires >= ${POLICY_THRESHOLDS.MANDATE_MIN_PREVIOUS_SUCCESSFUL_PAYMENTS} prior successful payments; customer has ${transaction.previous_successful_payments}.`,
        requires_human: true,
      };
    }

    // escalate_receivables has no additional numeric ceiling beyond RULE 4
    // (already evaluated above), so amounts at or below the receivable
    // threshold are allowed to proceed automatically.
    case 'escalate_receivables': {
      return {
        decision: 'ALLOW',
        rule_id: 'RECEIVABLE_ESCALATION_ALLOWED',
        reason: `Overdue receivable escalation of ${formatInr(transaction.amount_in_inr)} is within automated dunning limits.`,
        requires_human: false,
      };
    }

    // no_action never touches money and is always safe to allow.
    case 'no_action': {
      return {
        decision: 'ALLOW',
        rule_id: 'NO_ACTION_ALLOWED',
        reason: 'No recovery action recommended; nothing to execute and no human intervention required.',
        requires_human: false,
      };
    }

    // The AI explicitly asked for human review — policy honors that as-is.
    case 'human_review': {
      return {
        decision: 'HUMAN_REVIEW',
        rule_id: 'AI_REQUESTED_HUMAN_REVIEW',
        reason: 'AI explicitly recommended human review for this transaction.',
        requires_human: true,
      };
    }

    // Unreachable: every AIStrategy member is handled above, and non-members
    // were already rejected by the APPROVED_STRATEGIES guard.
    default: {
      return {
        decision: 'BLOCK',
        rule_id: 'UNKNOWN_STRATEGY_BLOCKED',
        reason: `Strategy "${strategy}" is not a recognized, policy-approved strategy.`,
        requires_human: true,
      };
    }
  }
}
