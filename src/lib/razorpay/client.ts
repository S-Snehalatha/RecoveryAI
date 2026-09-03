const BASE_URL = 'https://api.razorpay.com';

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay test credentials are not configured.');
  return { keyId, keySecret };
}

export async function razorpayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = credentials();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? JSON.stringify((body as { error: unknown }).error)
      : `Razorpay request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function razorpayTestModeConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}
