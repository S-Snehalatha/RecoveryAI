import { NextResponse } from 'next/server';
import { runRecoveryAgent } from '@/lib/agent/runner';
import { inMemoryStore } from '@/lib/db/inMemoryStore';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transactionId?: string };
    if (!body.transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }

    const transaction = inMemoryStore.getTransactionById(body.transactionId);
    if (!transaction) {
      return NextResponse.json({ error: `Transaction ${body.transactionId} not found` }, { status: 404 });
    }

    const result = await runRecoveryAgent(transaction);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent analysis failed.' },
      { status: 500 },
    );
  }
}
