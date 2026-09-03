import crypto from 'crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { verifyRazorpayWebhookSignature, processRazorpayWebhook } from '@/lib/razorpay/webhook';
import { razorpayRequest } from '@/lib/razorpay/client';

describe('RecoverAI — Phase 7 Razorpay integration', () => {
  const oldSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    inMemoryStore.reset();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (oldSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = oldSecret;
  });

  it('verifies valid and rejects invalid webhook signatures', () => {
    const body = JSON.stringify({ event: 'payment_link.paid' });
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
    expect(verifyRazorpayWebhookSignature(body, signature)).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, 'bad-signature')).toBe(false);
  });

  it('rejects an invalid webhook before storing or processing it', async () => {
    await expect(processRazorpayWebhook('{"event":"payment_link.paid"}', 'bad', 'evt_bad')).rejects.toThrow('Invalid Razorpay webhook signature');
    expect(inMemoryStore.getWebhookEvents()).toHaveLength(0);
  });

  it('processes a payment_link.paid webhook once and confirms recovered revenue', async () => {
    const tx = inMemoryStore.getTransactions().find((t) => t.demo_scenario === 'PAYMENT_LINK_RECOVERY')!;
    inMemoryStore.updateTransaction(tx.id, { status: 'executing' });
    inMemoryStore.insertRecoveryAttempt({ id: 'att-rzp-1', transaction_id: tx.id, execution_mode: 'RAZORPAY_TEST_MODE', strategy: 'send_payment_link', gateway_action_id: 'plink_test_1', gateway_status: 'created', request_payload: {}, response_payload: {}, status: 'DISPATCHED', executed_at: new Date().toISOString() });
    const body = JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_test_1', status: 'paid', amount: tx.amount_in_inr * 100, notes: { recoverai_transaction_id: tx.id } } }, payment: { entity: { id: 'pay_test_1', status: 'captured', amount: tx.amount_in_inr * 100, amount_captured: tx.amount_in_inr * 100, notes: { recoverai_transaction_id: tx.id } } } } });
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');

    const first = await processRazorpayWebhook(body, signature, 'evt_1');
    const second = await processRazorpayWebhook(body, signature, 'evt_1');
    expect(first.recoveryConfirmed).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(inMemoryStore.getRecoveryResults(tx.id)).toHaveLength(1);
    expect(inMemoryStore.getRecoveryResults(tx.id)[0]?.verification_source).toBe('WEBHOOK_SIGNATURE');
    expect(inMemoryStore.getTransactionById(tx.id)?.status).toBe('recovered');
  });

  it('does not treat payment-link creation as recovered revenue', () => {
    const tx = inMemoryStore.getTransactions().find((t) => t.demo_scenario === 'PAYMENT_LINK_RECOVERY')!;
    expect(inMemoryStore.getRecoveryResults(tx.id)).toHaveLength(0);
  });

  it('uses Basic authentication for Razorpay API requests and surfaces failure responses', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'plink_test', status: 'created' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { description: 'Bad credentials' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await razorpayRequest('/v1/payment_links', { method: 'POST', body: JSON.stringify({ amount: 1000, currency: 'INR' }) });
    const auth = fetchMock.mock.calls[0]?.[1]?.headers instanceof Headers
      ? (fetchMock.mock.calls[0]?.[1]?.headers as Headers).get('Authorization')
      : undefined;
    expect(auth).toBe(`Basic ${Buffer.from('rzp_test_key:rzp_test_secret').toString('base64')}`);
    await expect(razorpayRequest('/v1/payment_links', { method: 'POST', body: '{}' })).rejects.toThrow('Bad credentials');
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });
});
