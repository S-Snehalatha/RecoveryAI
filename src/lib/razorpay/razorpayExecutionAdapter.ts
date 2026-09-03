import { randomUUID } from 'crypto';
import { AIStrategy, RecoveryAttempt, Transaction } from '@/types';
import { razorpayRequest } from './client';
import { ExecutionAdapterResult, RecoveryExecutionAdapter } from './executionAdapter';

type PaymentLinkResponse = { id: string; short_url?: string; status?: string };
type OrderResponse = { id: string; amount: number; currency: string; status: string };
type SubscriptionResponse = { id: string; status: string; short_url?: string };

export class RazorpayExecutionAdapter implements RecoveryExecutionAdapter {
  readonly mode = 'RAZORPAY_TEST_MODE' as const;

  async execute(transaction: Transaction, strategy: AIStrategy, policyDecisionId: string): Promise<ExecutionAdapterResult> {
    const now = new Date().toISOString();
    const attemptId = `att-${randomUUID()}`;
    let actionId: string;
    let paymentUrl: string | undefined;
    let responsePayload: Record<string, unknown>;

    if (strategy === 'send_payment_link') {
      const body = await razorpayRequest<PaymentLinkResponse>('/v1/payment_links', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(transaction.amount_in_inr * 100),
          currency: 'INR',
          accept_partial: false,
          description: `RecoverAI recovery ${transaction.id}`,
          customer: { name: transaction.customer_name, email: transaction.customer_email, contact: transaction.customer_phone },
          reference_id: transaction.id,
          notes: { recoverai_transaction_id: transaction.id, recoverai_attempt_id: attemptId },
        }),
      });
      actionId = body.id;
      paymentUrl = body.short_url;
      responsePayload = body as unknown as Record<string, unknown>;
    } else if (strategy === 'retry_payment') {
      // Razorpay does not expose a generic "retry failed payment" endpoint. Creating an Order
      // is an order-management operation, not proof of payment recovery, so this adapter refuses it.
      throw new Error('RAZORPAY_UNSUPPORTED_STRATEGY: generic retry_payment has no documented API endpoint; no Order is created as a fake retry.');
    } else if (strategy === 'retry_mandate') {
      // No undocumented mandate-retry endpoint is used. Existing subscription flows require
      // the documented subscription resource and its configured plan/customer context.
      if (!transaction.subscription_id) throw new Error('RAZORPAY_UNSUPPORTED_STRATEGY: retry_mandate requires a documented subscription context.');
      const body = await razorpayRequest<SubscriptionResponse>(`/v1/subscriptions/${encodeURIComponent(transaction.subscription_id)}`, { method: 'GET' });
      actionId = body.id;
      responsePayload = body as unknown as Record<string, unknown>;
      throw new Error(`RAZORPAY_NO_MANDATE_RETRY_ACTION: subscription ${body.id} was inspected (status ${body.status}); no undocumented mandate retry was attempted.`);
    } else if (strategy === 'escalate_receivables') {
      throw new Error('RAZORPAY_UNSUPPORTED_STRATEGY: Razorpay documented APIs do not provide a generic receivables-escalation action for this transaction model.');
    } else {
      throw new Error(`RAZORPAY_UNSUPPORTED_STRATEGY: ${strategy} is not an executable gateway action.`);
    }

    const attempt: RecoveryAttempt = {
      id: attemptId,
      transaction_id: transaction.id,
      policy_decision_id: policyDecisionId,
      execution_mode: 'RAZORPAY_TEST_MODE',
      strategy,
      gateway_action_id: actionId,
      gateway_status: 'CREATED',
      payment_url: paymentUrl,
      request_payload: { transaction_id: transaction.id, strategy, amount_in_inr: transaction.amount_in_inr },
      response_payload: responsePayload,
      status: 'DISPATCHED',
      executed_at: now,
    };
    return { attempt };
  }
}

export async function inspectTestOrder(orderId: string): Promise<OrderResponse> {
  return razorpayRequest<OrderResponse>(`/v1/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}
