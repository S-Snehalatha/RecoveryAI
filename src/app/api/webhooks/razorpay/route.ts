import { NextResponse } from 'next/server';
import { processRazorpayWebhook } from '@/lib/razorpay/webhook';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  const eventId = request.headers.get('x-razorpay-event-id') ?? '';
  try {
    const result = await processRazorpayWebhook(rawBody, signature, eventId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    const status = message.includes('signature') || message.includes('header') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
