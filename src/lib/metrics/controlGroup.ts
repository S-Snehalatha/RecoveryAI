import { ControlGroupRecord, ExperimentGroup, RecoveryResult, Transaction } from '@/types';
import { calculateRevenueAtRisk } from './revenueAtRisk';
import { calculateVerifiedRecovery } from './verifiedRecovery';
import { calculateRecoveryRate } from './recoveryRate';

/**
 * Control-group comparison (Phase 5, service 6)
 * --------------------------------------------------
 * RecoverAI splits transactions into two experiment groups so the AI
 * pipeline's effect can be measured against a baseline:
 *
 *   AI_RECOVERY_GROUP — went through AI diagnosis → policy → execution →
 *                        webhook verification. Recovered amount comes from
 *                        verified RecoveryResult records.
 *
 *   CONTROL_GROUP     — deliberately NOT processed by the AI/policy/
 *                        execution pipeline. Its outcome is whatever the
 *                        merchant's pre-existing (non-AI) process would
 *                        have done, recorded separately as a
 *                        ControlGroupRecord baseline.
 *
 * These two populations must never be mixed into a single recovered-amount
 * figure — that is the entire point of running a control group.
 */
export interface GroupRevenueStats {
  group: ExperimentGroup;
  transactionCount: number;
  revenueAtRiskInr: number;
  recoveredAmountInr: number;
  /** recoveredAmountInr / revenueAtRiskInr, in [0, 1]. */
  recoveryRate: number;
}

export interface ControlGroupComparison {
  aiGroup: GroupRevenueStats;
  controlGroup: GroupRevenueStats;
}

/**
 * Baseline recovery for the control group comes from ControlGroupRecord
 * entries, not from RecoveryResult (control-group transactions never enter
 * the AI/policy/execution pipeline). De-duplicated by transaction id for
 * the same reason as verifiedRecovery.ts — a baseline should only be
 * counted once per transaction.
 */
function calculateControlBaselineRecovery(records: ControlGroupRecord[]): number {
  const countedTransactionIds = new Set<string>();
  let total = 0;

  for (const record of records) {
    if (record.baseline_outcome !== 'VERIFIED_RECOVERED') continue;
    if (countedTransactionIds.has(record.transaction_id)) continue;
    countedTransactionIds.add(record.transaction_id);
    total += record.baseline_recovered_amount;
  }

  return total;
}

export function compareControlGroups(
  transactions: Transaction[],
  recoveryResults: RecoveryResult[],
  controlGroupRecords: ControlGroupRecord[]
): ControlGroupComparison {
  const aiTransactions = transactions.filter((tx) => tx.experiment_group === 'AI_RECOVERY_GROUP');
  const controlTransactions = transactions.filter((tx) => tx.experiment_group === 'CONTROL_GROUP');

  const aiTransactionIds = new Set(aiTransactions.map((tx) => tx.id));
  const controlTransactionIds = new Set(controlTransactions.map((tx) => tx.id));

  const aiRecoveryResults = recoveryResults.filter((r) => aiTransactionIds.has(r.transaction_id));
  const controlBaselineRecords = controlGroupRecords.filter((r) => controlTransactionIds.has(r.transaction_id));

  const aiAtRisk = calculateRevenueAtRisk(aiTransactions);
  const aiRecovered = calculateVerifiedRecovery(aiRecoveryResults);

  const controlAtRisk = calculateRevenueAtRisk(controlTransactions);
  const controlRecovered = calculateControlBaselineRecovery(controlBaselineRecords);

  return {
    aiGroup: {
      group: 'AI_RECOVERY_GROUP',
      transactionCount: aiTransactions.length,
      revenueAtRiskInr: aiAtRisk,
      recoveredAmountInr: aiRecovered,
      recoveryRate: calculateRecoveryRate(aiRecovered, aiAtRisk),
    },
    controlGroup: {
      group: 'CONTROL_GROUP',
      transactionCount: controlTransactions.length,
      revenueAtRiskInr: controlAtRisk,
      recoveredAmountInr: controlRecovered,
      recoveryRate: calculateRecoveryRate(controlRecovered, controlAtRisk),
    },
  };
}
