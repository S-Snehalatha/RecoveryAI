import { evaluatePolicy } from "@/lib/policy";
import { Transaction, PolicyDecision } from "@/types";

export interface AgentToolResult {
  toolName: string;
  allowed: boolean;
  policyDecision: PolicyDecision;
  data?: Record<string, unknown>;
}

export const executeAgentTool = async (
  toolName: string,
  args: { transaction: Transaction; amount?: number; expiryDays?: number }
): Promise<AgentToolResult> => {
  const { transaction } = args;

  // 1. Intercept with Policy Engine
  const policyDecision = evaluatePolicy(transaction, {
    diagnosis: { primary_reason: "Agent automated strategy", explanation: "Triggered by agent tool call" },
    recommended_strategy: toolName === "issue_payment_link" ? "send_payment_link" : "retry_payment",
    confidence: 0.85,
    expected_recovery_value: transaction.amount,
    decision_explanation: "Agent executed action request"
  });

  // 2. Enforce Policy Result
  if (policyDecision.decision !== "ALLOW") {
    return {
      toolName,
      allowed: false,
      policyDecision,
      data: { status: "BLOCKED_BY_POLICY", reason: policyDecision.reason }
    };
  }

  // 3. Execute Action if Allowed
  return {
    toolName,
    allowed: true,
    policyDecision,
    data: { status: "EXECUTED_SUCCESSFULLY", transactionId: transaction.id }
  };
};
