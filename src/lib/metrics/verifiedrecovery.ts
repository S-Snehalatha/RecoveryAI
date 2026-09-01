import { RecoveryResult } from '@/types';

/**
 * Verified-recovery calculation (Phase 5, service 4)
 * -----------------------------------------------------
 * Definition: money for which a VERIFIED successful outcome exists.
 *
 * A payment link being created is an ATTEMPT (see recoveryAttempted.ts),
 * not recovered revenue. Only a RecoveryResult with
 * outcome_status === 'VERIFIED_RECOVERED' counts here — i.e. a gateway
 * webhook signature or direct reconciliation actually confirmed the money
 * arrived.
 *
 * De-duplication is load-bearing: gateway webhooks can and do fire more
 * than once for the same payment (retries, at-least-once delivery). If
 * two RecoveryResult rows exist for the same transaction, that transaction's
 * recovered amount must only be counted ONCE, not twice.
 */
export function calculateVerifiedRecovery(results: RecoveryResult[]): number {
  const countedTransactionIds = new Set<string>();
  let total = 0;

  for (const result of results) {
    if (result.outcome_status !== 'VERIFIED_RECOVERED') continue;
    if (countedTransactionIds.has(result.transaction_id)) continue; // duplicate webhook/result guard
    countedTransactionIds.add(result.transaction_id);
    total += result.recovered_amount_in_inr;
  }

  return total;
}
