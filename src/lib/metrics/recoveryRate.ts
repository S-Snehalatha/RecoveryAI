/**
 * Recovery-rate calculation (Phase 5, service 5)
 * --------------------------------------------------
 * A generic, dimensionless ratio calculator: recoveredAmount / baseAmount.
 * Used both for "recovered ÷ attempted" (conversion rate of attempts that
 * actually succeeded) and "recovered ÷ at-risk" (overall recovery rate).
 *
 * Returns a value in [0, 1] under normal inputs, and 0 (never NaN or
 * Infinity) when baseAmount is zero or negative — a system with nothing
 * at risk has a well-defined recovery rate of 0, not an error.
 */
export function calculateRecoveryRate(recoveredAmountInr: number, baseAmountInr: number): number {
  if (!Number.isFinite(baseAmountInr) || baseAmountInr <= 0) return 0;
  if (!Number.isFinite(recoveredAmountInr) || recoveredAmountInr < 0) return 0;
  return recoveredAmountInr / baseAmountInr;
}
