import { GroupRevenueStats } from './controlGroup';

/**
 * Incremental-recovery calculation (Phase 5, service 7)
 * ----------------------------------------------------------
 * Estimates how much additional money the AI pipeline recovered compared
 * to what the control group's baseline rate would predict for an
 * equivalent population.
 *
 * IMPORTANT — this is a naive point-estimate lift metric, NOT a causal or
 * statistically validated result:
 *   - No p-value, confidence interval, or hypothesis test is computed.
 *   - No adjustment is made for sample size, transaction mix, or
 *     seasonality differences between the two groups.
 *   - It should be reported and read as "here is the directional lift
 *     under a simple constant-rate assumption," never as "the AI pipeline
 *     has been proven to cause X rupees of additional recovery."
 *
 * Callers (dashboards, reports) MUST surface the `note` field or an
 * equivalent disclaimer alongside this number — do not present
 * incrementalRecoveredAmountInr as a statistically significant result.
 */
export interface IncrementalRecoveryResult {
  aiRecoveredAmountInr: number;
  /** What the AI group would have recovered if it had performed at the control group's rate. */
  expectedRecoveryAtControlRateInr: number;
  /** aiRecoveredAmountInr - expectedRecoveryAtControlRateInr. Can be negative. */
  incrementalRecoveredAmountInr: number;
  aiRecoveryRate: number;
  controlRecoveryRate: number;
  /** aiRecoveryRate - controlRecoveryRate, as a raw ratio (not a percentage string). */
  recoveryRateLift: number;
  sampleSizes: {
    aiGroupTransactions: number;
    controlGroupTransactions: number;
  };
  note: string;
}

const NO_SIGNIFICANCE_DISCLAIMER =
  'Point-estimate lift only. No statistical significance test (p-value, confidence interval, or hypothesis test) has been computed. Do not report this figure as a proven causal effect.';

export function calculateIncrementalRecovery(
  aiGroup: GroupRevenueStats,
  controlGroup: GroupRevenueStats
): IncrementalRecoveryResult {
  const expectedRecoveryAtControlRateInr = controlGroup.recoveryRate * aiGroup.revenueAtRiskInr;
  const incrementalRecoveredAmountInr = aiGroup.recoveredAmountInr - expectedRecoveryAtControlRateInr;

  return {
    aiRecoveredAmountInr: aiGroup.recoveredAmountInr,
    expectedRecoveryAtControlRateInr,
    incrementalRecoveredAmountInr,
    aiRecoveryRate: aiGroup.recoveryRate,
    controlRecoveryRate: controlGroup.recoveryRate,
    recoveryRateLift: aiGroup.recoveryRate - controlGroup.recoveryRate,
    sampleSizes: {
      aiGroupTransactions: aiGroup.transactionCount,
      controlGroupTransactions: controlGroup.transactionCount,
    },
    note: NO_SIGNIFICANCE_DISCLAIMER,
  };
}
