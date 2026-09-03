import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { recordAuditEvent } from '@/lib/audit';

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type PaymentLinkPaidPayload = {
  event?: string;
  payload?: {
    payment_link?: { entity?: { id?: string; status?: string; amount?: number; notes?: Record<string, unknown> } };
    payment?: { entity?: { id?: string; status?: string; amount?: number; amount_captured?: number; notes?: Record<string, unknown> } };
  };
};

export async function processRazorpayWebhook(rawBody: string, signature: string, eventId: string) {
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) throw new Error('Invalid Razorpay webhook signature.');
  if (!eventId) throw new Error('Missing x-razorpay-event-id header.');
  const existing = inMemoryStore.getWebhookEventByGatewayId(eventId);
  if (existing) return { duplicate: true, processed: existing.processed };

  let payload: PaymentLinkPaidPayload;
  try { payload = JSON.parse(rawBody) as PaymentLinkPaidPayload; } catch { throw new Error('Invalid webhook JSON.'); }
  const eventType = payload.event ?? 'unknown';
  const event = inMemoryStore.insertWebhookEvent({ id: `wh-${randomUUID()}`, gateway_event_id: eventId, event_type: eventType, execution_mode: 'RAZORPAY_TEST_MODE', payload: payload as unknown as Record<string, unknown>, signature_header: signature, is_verified: true, processed: false, created_at: new Date().toISOString() });

  if (eventType !== 'payment_link.paid') {
    inMemoryStore.updateWebhookEvent(event.id, { processed: true, processed_at: new Date().toISOString() });
    return { duplicate: false, processed: true, recoveryConfirmed: false, eventType };
  }

  const link = payload.payload?.payment_link?.entity;
  const payment = payload.payload?.payment?.entity;
  const transactionId = typeof link?.notes?.recoverai_transaction_id === 'string'
    ? link.notes.recoverai_transaction_id
    : typeof payment?.notes?.recoverai_transaction_id === 'string'
      ? payment.notes.recoverai_transaction_id
      : undefined;
  if (!transactionId || !link?.id) {
    inMemoryStore.updateWebhookEvent(event.id, { processed: true, processed_at: new Date().toISOString() });
    return { duplicate: false, processed: true, recoveryConfirmed: false, eventType };
  }

  const transaction = inMemoryStore.getTransactionById(transactionId);
  const attempt = inMemoryStore.getRecoveryAttemptByGatewayActionId(link.id);
  if (!transaction || !attempt || attempt.execution_mode !== 'RAZORPAY_TEST_MODE') {
    inMemoryStore.updateWebhookEvent(event.id, { processed: true, processed_at: new Date().toISOString() });
    return { duplicate: false, processed: true, recoveryConfirmed: false, eventType };
  }

  const existingResult = inMemoryStore.getRecoveryResults(transaction.id).find((r) => r.recovery_attempt_id === attempt.id);
  if (!existingResult) {
    const amountPaise = payment?.amount_captured ?? payment?.amount ?? link.amount ?? 0;
    const result = inMemoryStore.insertRecoveryResult({ id: `res-${randomUUID()}`, recovery_attempt_id: attempt.id, transaction_id: transaction.id, outcome_status: 'VERIFIED_RECOVERED', recovered_amount_in_inr: amountPaise / 100, gateway_payment_id: payment?.id, verification_source: 'WEBHOOK_SIGNATURE', verification_payload: payload as unknown as Record<string, unknown>, verified_at: new Date().toISOString() });
    inMemoryStore.updateTransaction(transaction.id, { status: 'recovered' });
    inMemoryStore.updateWebhookEvent(event.id, { processed: true, processed_at: new Date().toISOString() });
    recordAuditEvent({ event_type: 'RECOVERY_CONFIRMED', actor_type: 'GATEWAY_ADAPTER', actor_id: 'razorpay-webhook', transaction_id: transaction.id, what: 'VERIFIED_RECOVERED', why: 'Razorpay payment_link.paid webhook verified by HMAC signature.', result: 'VERIFIED_RECOVERED', amount_in_inr: result.recovered_amount_in_inr, state_after: { execution_mode: 'RAZORPAY_TEST_MODE', webhook_event_id: eventId, payment_link_id: link.id, payment_id: payment?.id } });
  } else {
    inMemoryStore.updateWebhookEvent(event.id, { processed: true, processed_at: new Date().toISOString() });
  }
  return { duplicate: false, processed: true, recoveryConfirmed: true, eventType };
}
