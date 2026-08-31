import { z } from 'zod';

export const LossTypeSchema = z.enum([
  'failed_payment',
  'abandoned_checkout',
  'subscription_failure',
  'overdue_receivable',
]);

export const AIStrategySchema = z.enum([
  'retry_payment',
  'send_payment_link',
  'retry_mandate',
  'escalate_receivables',
  'human_review',
  'no_action',
]);

export const PolicyDecisionSchema = z.enum(['ALLOW', 'HUMAN_REVIEW', 'BLOCK']);

export const IngestTransactionSchema = z.object({
  original_reference_id: z.string().min(1, 'Reference ID is required'),
  loss_type: LossTypeSchema,
  amount_in_inr: z.number().positive('Amount must be positive'),
  currency: z.literal('INR').default('INR'),
  customer: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    tier: z.enum(['STANDARD', 'VIP', 'ENTERPRISE']).optional().default('STANDARD'),
    tenure_days: z.number().nonnegative().default(30),
  }),
  attempt_count: z.number().int().nonnegative().default(1),
  previous_successful_payments: z.number().int().nonnegative().default(0),
  failure_reason_raw: z.string().optional(),
  gateway_error_code: z.string().optional(),
});

export const AIDiagnosticOutputSchema = z.object({
  strategy: AIStrategySchema,
  confidence: z.number().min(0).max(1),
  diagnosis_code: z.string().min(1).max(50),
  concise_rationale: z.string().min(5).max(300),
  suggested_delay_minutes: z.number().int().nonnegative().default(0),
  suggested_discount_pct: z.number().min(0).max(15).default(0),
});
