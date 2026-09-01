import { RecoveryAttempt, Transaction } from '@/types';

/**
 * Recovery-attempted calculation (Phase 5, service 3)
 * ------------------------------------------------------
 * Definition: money for which a REAL recovery intervention was initiated.
 *
 * Critically: an AI recommendation is NOT a recovery attempt, and a
 * policy ALLOW is NOT a recovery attempt either — only a RecoveryAttempt
 * record whose status shows the intervention actually left the building
 * (dispatched to the gateway, or further along) counts. A PENDING attempt
 * (queued but not yet dispatched) does not count as money attempted yet.
 *
 * Money is attributed once per transaction — a transaction retried three
 * times contributes its amount to "attempted" once, not three times,
 * since it is the same underlying money at risk.
 */

// Every status except PENDING means the intervention was actually initiated
// (dispatched to a gateway/customer channel), even if it later failed,
// expired, or was cancelled after dispatch.
const NOT_YET_INITIATED_STATUSES: ReadonlySet<RecoveryAttempt['status']> = new Set(['PENDING']);

export function calculateRecoveryAttempted(transactions: Transaction[], attempts: RecoveryAttempt[]): number {
  const transactionById = new Map(transactions.map((tx) => [tx.id, tx]));
  const qualifyingTransactionIds = new Set<string>();

  for (const attempt of attempts) {
    if (NOT_YET_INITIATED_STATUSES.has(attempt.status)) continue;
    qualifyingTransactionIds.add(attempt.transaction_id);
  }

  let total = 0;
  for (const txId of qualifyingTransactionIds) {
    const tx = transactionById.get(txId);
    if (tx) total += tx.amount_in_inr;
  }

  return total;
}
