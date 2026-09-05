import { evaluatePolicy, PolicyEvaluation } from '@/lib/policy';
import { Transaction } from '@/types';

export interface AgentToolResult {
  toolName: string;
  allowed: boolean;
  policyDecision: PolicyEvaluation;
  data?: Record<string, unknown>;
}

export const executeAgentTool = async (
  toolName: string,
  args: { transaction: Transaction; amount?: number; expiryDays?: number }
): Promise<AgentToolResult> => {
  const { transaction } = args;
  const txAmount = args.amount ?? transaction.amount_in_inr;

  const policyDecision = evaluatePolicy(transaction, {
    recommended_strategy: toolName === 'issue_payment_link' ? 'send_payment_link' : 'retry_payment',
    confidence_score: 0.85,
  });

  if (policyDecision.decision !== 'ALLOW') {
    return {
      toolName,
      allowed: false,
      policyDecision,
      data: { status: 'BLOCKED_BY_POLICY', reason: policyDecision.reason, amount: txAmount },
    };
  }

  return {
    toolName,
    allowed: true,
    policyDecision,
    data: { status: 'EXECUTED_SUCCESSFULLY', transactionId: transaction.id, amount: txAmount },
  };
};
