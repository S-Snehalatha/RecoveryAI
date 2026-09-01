import { ExperimentGroup, Transaction } from '@/types';

/**
 * Revenue-at-risk calculation (Phase 5, service 2)
 * --------------------------------------------------
 * Definition: money associated with qualifying at-risk transactions.
 * Every Transaction record in RecoverAI represents, by construction, an
 * at-risk transaction (a failed payment, an abandoned checkout, a failed
 * subscription debit, or an overdue receivable) — so revenue-at-risk is
 * simply the sum of amount_in_inr across the transactions in scope.
 *
 * This is a pure function: no I/O, no side effects, dedupes defensively
 * by transaction id in case the caller passes an array with duplicates.
 */
export interface RevenueAtRiskOptions {
  /** Restrict the calculation to one experiment group (AI vs control). */
  experimentGroup?: ExperimentGroup;
}

export function calculateRevenueAtRisk(transactions: Transaction[], options: RevenueAtRiskOptions = {}): number {
  const seen = new Set<string>();
  let total = 0;

  for (const tx of transactions) {
    if (options.experimentGroup && tx.experiment_group !== options.experimentGroup) continue;
    if (seen.has(tx.id)) continue; // defensive de-dup: never double-count the same transaction
    seen.add(tx.id);
    total += tx.amount_in_inr;
  }

  return total;
}
