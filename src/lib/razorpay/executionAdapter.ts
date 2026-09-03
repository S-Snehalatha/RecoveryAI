import { AIStrategy, RecoveryAttempt, RecoveryResult, Transaction } from '@/types';

export interface ExecutionAdapterResult {
  attempt: RecoveryAttempt;
  result?: RecoveryResult;
}

export interface RecoveryExecutionAdapter {
  readonly mode: 'DEMO_SIMULATION' | 'RAZORPAY_TEST_MODE';
  execute(transaction: Transaction, strategy: AIStrategy, policyDecisionId: string): Promise<ExecutionAdapterResult>;
}
