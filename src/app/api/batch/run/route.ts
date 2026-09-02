import { NextResponse } from 'next/server';
import { runRecoveryBatch } from '@/lib/recovery/batchRunner';

export async function POST() {
  try {
    const summary = await runRecoveryBatch();
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch run failed.' },
      { status: 500 },
    );
  }
}
