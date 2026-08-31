import { IAIProvider } from './provider';
import { AIOutput } from './schemas';
import { Transaction } from '@/types';

export class DemoAIProvider implements IAIProvider {
  public readonly name = 'DemoAIProvider (Deterministic)';

  async diagnose(transaction: Transaction): Promise<AIOutput> {
    const rawReason = (transaction.failure_reason_raw || '').toLowerCase();
    const customerName = (transaction.customer_name || '').toLowerCase();

    // 1. DEFENSE AGAINST PROMPT INJECTION
    const injectionPatterns = [
      'ignore previous instructions',
      'ignore all instructions',
      'system prompt',
      'override policy',
      'refund',
      'credit note',
      'execute immediately',
      'transfer funds',
      'bypass policy',
    ];

    const hasInjection = injectionPatterns.some(
      (p) => rawReason.includes(p) || customerName.includes(p)
    );

    if (hasInjection) {
      return {
        diagnosis: {
          primary_reason: 'PROMPT_INJECTION_DETECTED',
          explanation: 'Malicious or suspicious instruction pattern detected in transaction data fields.',
        },
        recommended_strategy: 'human_review',
        confidence: 0.0,
        expected_recovery_value: 0.0,
        decision_explanation: 'Security gate triggered: Potential prompt injection isolated and routed to security review.',
      };
    }

    // 2. DETERMINISTIC DEMO SCENARIO MAPPINGS
    if (transaction.demo_scenario === 'SAFE_AUTO_RETRY') {
      return {
        diagnosis: {
          primary_reason: 'TRANSIENT_3DS_TIMEOUT',
          explanation: 'Customer network timed out during 2FA authorization; high customer trust profile.',
        },
        recommended_strategy: 'retry_payment',
        confidence: 0.88,
        expected_recovery_value: transaction.amount_in_inr,
        decision_explanation: 'Low-value transaction (≤ ₹5,000) with 5 prior successful payments. Safe automated retry recommended.',
      };
    }

    if (transaction.demo_scenario === 'OVER_LIMIT_REVIEW') {
      return {
        diagnosis: {
          primary_reason: 'HIGH_VALUE_CHECKOUT_DECLINE',
          explanation: 'Card checkout limit exceeded on high-ticket purchase (₹32,500).',
        },
        recommended_strategy: 'send_payment_link',
        confidence: 0.78,
        expected_recovery_value: transaction.amount_in_inr * 0.8,
        decision_explanation: 'Amount exceeds automated micro-retry threshold. Smart payment link recommended under human approval.',
      };
    }

    if (transaction.demo_scenario === 'LOW_CONFIDENCE_REVIEW') {
      return {
        diagnosis: {
          primary_reason: 'CART_ANOMALY_UNCERTAINTY',
          explanation: 'Repeated address mutations followed by rapid exit indicates high chargeback/dispute risk.',
        },
        recommended_strategy: 'human_review',
        confidence: 0.45,
        expected_recovery_value: 0.0,
        decision_explanation: 'Model confidence is 0.45 (< 0.60 threshold). Mandatory operator risk inspection required.',
      };
    }

    if (transaction.demo_scenario === 'PAYMENT_LINK_RECOVERY') {
      return {
        diagnosis: {
          primary_reason: 'UPI_INTENT_DROP_OFF',
          explanation: 'Customer dropped off at UPI intent screen with valid active session intent.',
        },
        recommended_strategy: 'send_payment_link',
        confidence: 0.91,
        expected_recovery_value: transaction.amount_in_inr * 0.85,
        decision_explanation: 'High conversion probability. Re-engage customer with dynamic payment link via SMS/WhatsApp.',
      };
    }

    if (transaction.demo_scenario === 'SUBSCRIPTION_REVIEW') {
      return {
        diagnosis: {
          primary_reason: 'NACH_DEBIT_ISSUER_REJECT',
          explanation: 'Mandate renewal failed on renewal date with fewer than 3 prior successful debits.',
        },
        recommended_strategy: 'human_review',
        confidence: 0.55,
        expected_recovery_value: 0.0,
        decision_explanation: 'Low historical mandate tenure (<3 successful payments). Manual customer success check advised.',
      };
    }

    if (transaction.demo_scenario === 'HIGH_VALUE_RECEIVABLE') {
      return {
        diagnosis: {
          primary_reason: 'ENTERPRISE_INVOICE_OVERDUE',
          explanation: 'Net-30 B2B invoice overdue by 16 days on high-exposure corporate account.',
        },
        recommended_strategy: 'escalate_receivables',
        confidence: 0.82,
        expected_recovery_value: transaction.amount_in_inr * 0.95,
        decision_explanation: 'Amount exceeds ₹50,000 policy threshold. Account manager dunning workflow recommended.',
      };
    }

    if (transaction.demo_scenario === 'BLOCKED_ACTION') {
      return {
        diagnosis: {
          primary_reason: 'MAX_RETRIES_EXHAUSTED',
          explanation: 'Transaction has failed 4 consecutive times across previous attempts.',
        },
        recommended_strategy: 'no_action',
        confidence: 0.95,
        expected_recovery_value: 0.0,
        decision_explanation: 'Exceeded maximum permitted retry attempts. Further retries will harm merchant risk score.',
      };
    }

    if (transaction.demo_scenario === 'SUCCESSFUL_RECOVERY') {
      return {
        diagnosis: {
          primary_reason: 'UPI_COLLECT_TIMEOUT_RESOLVED',
          explanation: 'Initial UPI collect expired but customer responded to dynamic recovery link.',
        },
        recommended_strategy: 'send_payment_link',
        confidence: 0.92,
        expected_recovery_value: transaction.amount_in_inr,
        decision_explanation: 'Smart payment link generated with instant payment verification.',
      };
    }

    if (transaction.demo_scenario === 'FAILED_RECOVERY') {
      return {
        diagnosis: {
          primary_reason: 'MANDATE_PERMANENTLY_CANCELLED',
          explanation: 'Customer explicitly revoked recurring mandate with issuing bank.',
        },
        recommended_strategy: 'no_action',
        confidence: 0.94,
        expected_recovery_value: 0.0,
        decision_explanation: 'Customer actively cancelled mandate. Automated retries are permanently blocked.',
      };
    }

    // 3. STANDARD GENERAL FALLBACK HEURISTICS
    if (transaction.loss_type === 'failed_payment') {
      if (transaction.amount_in_inr <= 5000 && transaction.attempt_count <= 2 && transaction.previous_successful_payments >= 3) {
        return {
          diagnosis: {
            primary_reason: 'TRANSIENT_GATEWAY_DROP',
            explanation: 'Temporary network or switch glitch during checkout.',
          },
          recommended_strategy: 'retry_payment',
          confidence: 0.84,
          expected_recovery_value: transaction.amount_in_inr * 0.9,
          decision_explanation: 'Standard micro-transaction retry within low-friction limits.',
        };
      }
      return {
        diagnosis: {
          primary_reason: 'CARD_DECLINE_OR_LIMIT',
          explanation: 'Checkout payment declined by bank switch.',
        },
        recommended_strategy: 'send_payment_link',
        confidence: 0.81,
        expected_recovery_value: transaction.amount_in_inr * 0.75,
        decision_explanation: 'Direct customer re-engagement via payment link with alternative payment options.',
      };
    }

    if (transaction.loss_type === 'abandoned_checkout') {
      return {
        diagnosis: {
          primary_reason: 'ABANDONED_CART_EXIT',
          explanation: 'User abandoned order prior to final confirmation.',
        },
        recommended_strategy: 'send_payment_link',
        confidence: 0.86,
        expected_recovery_value: transaction.amount_in_inr * 0.8,
        decision_explanation: 'Dynamic payment link with customized reminder notification.',
      };
    }

    if (transaction.loss_type === 'subscription_failure') {
      if (transaction.previous_successful_payments >= 3) {
        return {
          diagnosis: {
            primary_reason: 'MANDATE_CYCLE_DECLINE',
            explanation: 'Renewal debit rejected on standard billing cycle.',
          },
          recommended_strategy: 'retry_mandate',
          confidence: 0.85,
          expected_recovery_value: transaction.amount_in_inr * 0.95,
          decision_explanation: 'High historical trust profile. Programmatic e-mandate retry scheduled.',
        };
      }
      return {
        diagnosis: {
          primary_reason: 'UNVERIFIED_MANDATE_HISTORY',
          explanation: 'Mandate failed with insufficient historical track record.',
        },
        recommended_strategy: 'human_review',
        confidence: 0.52,
        expected_recovery_value: 0.0,
        decision_explanation: 'Confidence is 0.52 (< 0.60). Manual verification required before re-triggering mandate.',
      };
    }

    // Overdue Receivable
    if (transaction.amount_in_inr > 50000) {
      return {
        diagnosis: {
          primary_reason: 'HIGH_EXPOSURE_B2B_RECEIVABLE',
          explanation: 'Enterprise invoice past due date requiring formal escalation.',
        },
        recommended_strategy: 'escalate_receivables',
        confidence: 0.80,
        expected_recovery_value: transaction.amount_in_inr * 0.9,
        decision_explanation: 'High exposure invoice (> ₹50,000). Automated escalation sequence recommended.',
      };
    }

    return {
      diagnosis: {
        primary_reason: 'STANDARD_INVOICE_REMINDER',
        explanation: 'Invoice overdue; standard notification reminder link recommended.',
      },
      recommended_strategy: 'send_payment_link',
      confidence: 0.82,
      expected_recovery_value: transaction.amount_in_inr * 0.85,
      decision_explanation: 'Payment link reminder dispatched to corporate accounts payable contact.',
    };
  }
}