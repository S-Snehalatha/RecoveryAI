import { Transaction } from "@/types";
import { executeAgentTool, AgentToolResult } from "./tools";

export interface AgentRunOutput {
  transactionId: string;
  iterations: number;
  finalThought: string;
  toolResults: AgentToolResult[];
}

export async function runRecoveryAgent(transaction: Transaction): Promise<AgentRunOutput> {
  const toolResults: AgentToolResult[] = [];
  let iterations = 0;
  const maxIterations = 3;
  const txAmount = (transaction as Record<string, unknown>).amount as number || 0;

  // ReAct Loop Simulation
  while (iterations < maxIterations) {
    iterations++;

    if (txAmount <= 5000 && transaction.attempt_count <= 2) {
      const result = await executeAgentTool("execute_payment_retry", { transaction });
      toolResults.push(result);
      break;
    } else if (txAmount <= 25000) {
      const result = await executeAgentTool("issue_payment_link", { transaction, expiryDays: 3 });
      toolResults.push(result);
      break;
    } else {
      const result = await executeAgentTool("escalate_to_human", { transaction });
      toolResults.push(result);
      break;
    }
  }

  return {
    transactionId: transaction.id,
    iterations,
    finalThought: `Agent processed transaction ${transaction.id} in ${iterations} iteration(s).`,
    toolResults
  };
}
