import { NextRequest, NextResponse } from 'next/server';
import { generateAIDecision } from '@/lib/ai/decision';
import { inMemoryStore } from '@/lib/db/inMemoryStore';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'transactionId is required' },
        { status: 400 }
      );
    }

    const transaction = inMemoryStore.getTransactionById(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { error: `Transaction ${transactionId} not found` },
        { status: 404 }
      );
    }

    const aiDecision = await generateAIDecision(transaction);
    const updatedTx = inMemoryStore.getTransactionById(transactionId);

    return NextResponse.json({
      success: true,
      decision: aiDecision,
      transaction: updatedTx,
    });
  } catch (err) {
    console.error('[API /api/ai/diagnose Error]:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}