import {
  Transaction,
  RecoveryAttempt,
  RecoveryResult,
  ControlGroupRecord,
} from '../../src/types';

let txCounter = 0;
let attemptCounter = 0;
let resultCounter = 0;
let controlCounter = 0;

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  txCounter += 1;
  return {
    id: `tx-fixture-${txCounter}`,
    original_reference_id: `pay_fixture_${txCounter}`,
    loss_type: 'failed_payment',
    amount_in_inr: 1000,
    currency: 'INR',
    customer_id: `cust-fixture-${txCounter}`,
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

export function makeRecoveryAttempt(overrides: Partial<RecoveryAttempt> = {}): RecoveryAttempt {
  attemptCounter += 1;
  return {
    id: `att-fixture-${attemptCounter}`,
    transaction_id: `tx-fixture-${attemptCounter}`,
    execution_mode: 'DEMO_SIMULATION',
    strategy: 'send_payment_link',
    gateway_action_id: `sim_action_${attemptCounter}`,
    gateway_status: 'created',
    request_payload: {},
    response_payload: {},
    status: 'DISPATCHED',
    executed_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeRecoveryResult(overrides: Partial<RecoveryResult> = {}): RecoveryResult {
  resultCounter += 1;
  return {
    id: `res-fixture-${resultCounter}`,
    recovery_attempt_id: `att-fixture-${resultCounter}`,
    transaction_id: `tx-fixture-${resultCounter}`,
    outcome_status: 'VERIFIED_RECOVERED',
    recovered_amount_in_inr: 1000,
    verification_source: 'WEBHOOK_SIGNATURE',
    verification_payload: {},
    verified_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeControlGroupRecord(overrides: Partial<ControlGroupRecord> = {}): ControlGroupRecord {
  controlCounter += 1;
  return {
    id: `ctrl-fixture-${controlCounter}`,
    transaction_id: `tx-fixture-${controlCounter}`,
    baseline_strategy: 'no_action',
    baseline_outcome: 'UNRESOLVED',
    baseline_recovered_amount: 0,
    evaluated_at: new Date().toISOString(),
    ...overrides,
  };
}
