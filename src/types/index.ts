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

export type PaymentMethod =
  | 'card'
  | 'upi'
  | 'netbanking'
  | 'mandate_nach'
  | 'mandate_upi'
  | 'invoice_bank_transfer';

export type CustomerTier = 'STANDARD' | 'VIP' | 'ENTERPRISE';

export type DemoScenario =
  | 'SAFE_AUTO_RETRY'
  | 'OVER_LIMIT_REVIEW'
  | 'LOW_CONFIDENCE_REVIEW'
  | 'PAYMENT_LINK_RECOVERY'
  | 'SUBSCRIPTION_REVIEW'
  | 'HIGH_VALUE_RECEIVABLE'
  | 'BLOCKED_ACTION'
  | 'SUCCESSFUL_RECOVERY'
  | 'FAILED_RECOVERY'
  | 'STANDARD_STREAM';

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'review'
  | 'executing'
  | 'recovered'
  | 'failed'
  | 'blocked'
  | 'INGESTED'
  | 'DIAGNOSED'
  | 'POLICY_APPROVED'
  | 'NEEDS_HUMAN_REVIEW'
  | 'REJECTED_BY_POLICY'
  | 'RECOVERY_ATTEMPTED'
  | 'RECOVERED'
  | 'RECOVERY_FAILED'
  | 'CLOSED_UNRESOLVED';

export type AttemptStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export type OutcomeStatus =
  | 'VERIFIED_RECOVERED'
  | 'FAILED'
  | 'EXPIRED'
  | 'UNRESOLVED';

export type ActorType =
  | 'SYSTEM'
  | 'AI_ENGINE'
  | 'POLICY_ENGINE'
  | 'GATEWAY_ADAPTER'
  | 'HUMAN_OPERATOR';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: CustomerTier;
  ltv_inr: number;
  tenure_days: number;
}

export interface Transaction {
  id: string;
  original_reference_id: string;
  loss_type: LossType;
  amount_in_inr: number;
  currency: 'INR';
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_tier: CustomerTier;
  customer_ltv_inr: number;
  customer_tenure_days: number;
  payment_method: PaymentMethod;
  gateway_error_code?: string;
  failure_reason_raw?: string;
  attempt_count: number;
  previous_successful_payments: number;
  subscription_id?: string;
  subscription_plan_name?: string;
  invoice_id?: string;
  invoice_due_date?: string;
  invoice_overdue_days?: number;
  experiment_group: ExperimentGroup;
  demo_scenario?: DemoScenario;
  status: TransactionStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIDecision {
  id: string;
  transaction_id: string;
  recommended_strategy: AIStrategy;
  confidence_score: number;
  diagnosis_code: string;
  concise_rationale: string;
  suggested_delay_minutes: number;
  suggested_discount_pct: number;
  model_name: string;
  latency_ms: number;
  raw_llm_response?: Record<string, unknown>;
  created_at: string;
}

export interface PolicyDecisionRecord {
  id: string;
  transaction_id: string;
  ai_decision_id?: string;
  decision: PolicyDecision;
  approved_strategy?: AIStrategy | null;
  matched_rules: string[];
  violation_reasons: string[];
  is_override_required: boolean;
  evaluated_at: string;
}

export interface RecoveryAttempt {
  id: string;
  transaction_id: string;
  policy_decision_id?: string;
  execution_mode: ExecutionMode;
  strategy: AIStrategy;
  gateway_action_id: string;
  gateway_status: string;
  payment_url?: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  status: AttemptStatus;
  executed_at: string;
}

export interface RecoveryResult {
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

export interface AuditLog {
  id: string;
  transaction_id?: string;
  actor_type: ActorType;
  actor_id: string;
  action_type: string;
  state_before?: Record<string, unknown>;
  state_after: Record<string, unknown>;
  checksum_hash: string;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  gateway_event_id: string;
  event_type: string;
  execution_mode: ExecutionMode;
  payload: Record<string, unknown>;
  signature_header?: string;
  is_verified: boolean;
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface ControlGroupRecord {
  id: string;
  transaction_id: string;
  baseline_strategy: string;
  baseline_outcome?: OutcomeStatus;
  baseline_recovered_amount: number;
  evaluated_at: string;
}

export interface BatchRun {
  id: string;
  run_name: string;
  total_transactions: number;
  execution_mode: ExecutionMode;
  status: 'INITIALIZED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  metrics_summary: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
}

export interface HumanReview {
  id: string;
  transaction_id: string;
  ai_decision_id?: string;
  review_status: ReviewStatus;
  trigger_reason: string;
  reviewer_id?: string;
  reviewer_notes?: string;
  final_action?: AIStrategy;
  created_at: string;
  resolved_at?: string;
}

export interface DatabaseState {
  transactions: Transaction[];
  ai_decisions: AIDecision[];
  policy_decisions: PolicyDecisionRecord[];
  recovery_attempts: RecoveryAttempt[];
  recovery_results: RecoveryResult[];
  audit_log: AuditLog[];
  webhook_events: WebhookEvent[];
  control_groups: ControlGroupRecord[];
  batch_runs: BatchRun[];
  human_reviews: HumanReview[];
}