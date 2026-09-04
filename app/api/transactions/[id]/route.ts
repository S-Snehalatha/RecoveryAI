import { NextResponse } from 'next/server';
import { inMemoryStore } from '@/lib/db/inMemoryStore';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const transaction = inMemoryStore.getTransactionById(params.id);
  if (!transaction) return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
  return NextResponse.json({
    transaction,
    decision: inMemoryStore.getAIDecisions(transaction.id)[0] ?? null,
    policy: inMemoryStore.getPolicyDecisions(transaction.id)[0] ?? null,
    attempt: inMemoryStore.getRecoveryAttempts(transaction.id)[0] ?? null,
    result: inMemoryStore.getRecoveryResults(transaction.id)[0] ?? null,
    audits: inMemoryStore.getAuditLogs(transaction.id),
  });
}
