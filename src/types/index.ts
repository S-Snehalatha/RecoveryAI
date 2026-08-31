export type LossType =
  | 'failed_payment'
  | 'abandoned_checkout'
  | 'subscription_failure'
  | 'overdue_receivable';

export type AIStrategy =
  | 'retry_payment'
  | 'send_payment_link'
  | 'retry_mandate'
  | 'escalate_receivables'
  | 'human_review'
  | 'no_action';

export type PolicyDecision = 'ALLOW' | 'HUMAN_REVIEW' | 'BLOCK';

export type ExecutionMode = 'DEMO_SIMULATION' | 'RAZORPAY_TEST_MODE';

export type ExperimentGroup = 'AI_RECOVERY_GROUP' | 'CONTROL_GROUP';

export type TransactionStatus =
  | 'INGESTED'
  | 'DIAGNOSED'
  | 'POLICY_APPROVED'
  | 'NEEDS_HUMAN_REVIEW'
  | 'REJECTED_BY_POLICY'
  | 'RECOVERY_ATTEMPTED'
  | 'RECOVERED'
  | 'RECOVERY_FAILED'
  | 'CLOSED_UNRESOLVED';

export type OutcomeStatus =
  | 'VERIFIED_RECOVERED'
  | 'FAILED'
  | 'EXPIRED'
  | 'UNRESOLVED';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier?: 'STANDARD' | 'VIP' | 'ENTERPRISE';
  tenure_days: number;
}

export interface Transaction {
  id: string;
  original_reference_id: string;
  loss_type: LossType;
  amount_in_inr: number;
  currency: 'INR';
  customer: CustomerProfile;
  attempt_count: number;
  previous_successful_payments: number;
  failure_reason_raw?: string;
  gateway_error_code?: string;
  experiment_group: ExperimentGroup;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface AIDiagnosis {
  id: string;
  transaction_id: string;
  recommended_strategy: AIStrategy;
  confidence_score: number;
  diagnosis_code: string;
  concise_rationale: string;
  suggested_delay_minutes: number;
  suggested_discount_pct: number;
  raw_llm_response?: Record<string, unknown>;
  model_name: string;
  latency_ms: number;
  created_at: string;
}

export interface PolicyEvaluation {
  id: string;
  transaction_id: string;
  recommendation_id: string;
  decision: PolicyDecision;
  approved_strategy: AIStrategy | null;
  matched_rules: string[];
  violation_reasons: string[];
  requires_human_review: boolean;
  evaluated_at: string;
}

export interface RecoveryAttempt {
  id: string;
  transaction_id: string;
  policy_evaluation_id: string;
  execution_mode: ExecutionMode;
  strategy: AIStrategy;
  gateway_action_id: string;
  gateway_status: string;
  payment_url?: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  executed_at: string;
}

export interface RecoveryOutcome {
  id: string;
  recovery_attempt_id: string;
  transaction_id: string;
  outcome_status: OutcomeStatus;
  recovered_amount_in_inr: number;
  gateway_payment_id?: string;
  verification_source: 'WEBHOOK_SIGNATURE' | 'DIRECT_API_POLL' | 'SIMULATION_EVENT';
  verification_payload: Record<string, unknown>;
  verified_at: string;
}

export interface AuditLogEntry {
  id: string;
  transaction_id: string;
  actor_type: 'SYSTEM' | 'AI_ENGINE' | 'POLICY_ENGINE' | 'GATEWAY_ADAPTER' | 'HUMAN_OPERATOR';
  actor_id: string;
  action_type: string;
  state_before?: Record<string, unknown>;
  state_after: Record<string, unknown>;
  checksum_hash: string;
  created_at: string;
}
