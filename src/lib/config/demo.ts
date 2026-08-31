export const DEMO_CONFIG = {
  isDemoMode: true,
  simulationPrefix: 'sim_',
  mockLatencies: {
    aiDiagnosisMs: 250,
    policyEvaluationMs: 10,
    adapterExecutionMs: 300,
    webhookDelayMs: 2000,
  },
  defaultProbabilities: {
    paymentLinkRecoveryRate: 0.72,
    mandateRetryRecoveryRate: 0.85,
    b2bEscalationRecoveryRate: 0.60,
  },
  maxSyntheticBatch: 100,
} as const;
