import { AIStrategy, Transaction } from '@/types';
import { executeDemoRecovery } from '@/lib/recovery/demoExecutionAdapter';
import { RecoveryExecutionAdapter, ExecutionAdapterResult } from './executionAdapter';

export class DemoExecutionAdapter implements RecoveryExecutionAdapter {
  readonly mode = 'DEMO_SIMULATION' as const;

  async execute(transaction: Transaction, strategy: AIStrategy, policyDecisionId: string): Promise<ExecutionAdapterResult> {
    return executeDemoRecovery(transaction, strategy, policyDecisionId);
  }
}
