import { randomUUID } from 'crypto';
import { AIStrategy, RecoveryAttempt, RecoveryResult, Transaction } from '@/types';

export interface DemoExecutionResult {
  attempt: RecoveryAttempt;
  // Optional: a Payment Link dispatch is only an ATTEMPT until a later webhook
  // (or, in demo mode, a subsequent confirmation event) verifies the money
  // actually arrived. It must never be reported here as already recovered.
  result?: RecoveryResult;
}

/** Phase 6 execution boundary. No Razorpay or external gateway calls are made. */
export function executeDemoRecovery(
  transaction: Transaction,
  strategy: AIStrategy,
  policyDecisionId: string,
): DemoExecutionResult {
  const now = new Date().toISOString();
  const attemptId = `att-${randomUUID()}`;
  const shouldFail = transaction.demo_scenario === 'FAILED_RECOVERY';

  // A Payment Link is dispatched to the customer, not paid on the spot — the
  // customer still has to click it and pay. Only an attempt exists at this
  // point; recovery can only be confirmed later by a webhook/verification
  // event, so no RecoveryResult is created here.
  const isDeferredConfirmation = strategy === 'send_payment_link';

  const attempt: RecoveryAttempt = {
    id: attemptId,
    transaction_id: transaction.id,
    policy_decision_id: policyDecisionId,
    execution_mode: 'DEMO_SIMULATION',
    strategy,
    gateway_action_id: `sim-${transaction.id}-${strategy}`,
    gateway_status: shouldFail ? 'simulated_failed' : isDeferredConfirmation ? 'simulated_link_created' : 'simulated_executed',
    payment_url: strategy === 'send_payment_link' ? `demo://recovery/${transaction.id}` : undefined,
    request_payload: {
      execution_mode: 'DEMO_SIMULATION',
      simulated: true,
      transaction_id: transaction.id,
      amount_in_inr: transaction.amount_in_inr,
      strategy,
    },
    response_payload: {
      execution_mode: 'DEMO_SIMULATION',
      simulated: true,
      label: 'SIMULATED DEMO OUTCOME',
      status: shouldFail ? 'FAILED' : isDeferredConfirmation ? 'DISPATCHED' : 'SUCCEEDED',
    },
    status: shouldFail ? 'FAILED' : isDeferredConfirmation ? 'DISPATCHED' : 'SUCCEEDED',
    executed_at: now,
  };

  if (isDeferredConfirmation && !shouldFail) {
    // Payment Link creation is an ATTEMPT, not recovered revenue.
    // No RecoveryResult yet — the transaction stays in 'executing' awaiting
    // a later simulated confirmation event (Phase 7's webhook boundary).
    return { attempt };
  }

  const result: RecoveryResult = {
    id: `res-${randomUUID()}`,
    recovery_attempt_id: attemptId,
    transaction_id: transaction.id,
    outcome_status: shouldFail ? 'FAILED' : 'VERIFIED_RECOVERED',
    recovered_amount_in_inr: shouldFail ? 0 : transaction.amount_in_inr,
    gateway_payment_id: shouldFail ? undefined : `sim-pay-${transaction.id}`,
    verification_source: 'SIMULATION_EVENT',
    verification_payload: {
      execution_mode: 'DEMO_SIMULATION',
      simulated: true,
      label: 'SIMULATED DEMO OUTCOME',
      strategy,
      reason: shouldFail ? 'Deterministic FAILED_RECOVERY scenario' : 'Deterministic simulated recovery',
    },
    verified_at: now,
  };

  return { attempt, result };
}
