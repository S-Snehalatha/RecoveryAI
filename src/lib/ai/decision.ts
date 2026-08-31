import { Transaction, AIDecision } from '@/types';
import { getAIProvider } from './provider';
import { inMemoryStore } from '@/lib/db/inMemoryStore';
import { logger } from '@/lib/logger';

/**
 * Main AI Decision Generation Service
 * Invokes the configured AI provider, validates schema, tracks latency,
 * and persists the decision to the database.
 */
export async function generateAIDecision(transaction: Transaction): Promise<AIDecision> {
  const provider = getAIProvider();
  const startTime = Date.now();

  logger.info(`[AI Decision] Initiating diagnosis for transaction ${transaction.original_reference_id}`, {
    transactionId: transaction.id,
    lossType: transaction.loss_type,
    amount: transaction.amount_in_inr,
    provider: provider.name,
  });

  const output = await provider.diagnose(transaction);
  const latencyMs = Date.now() - startTime;

  const decisionRecord: AIDecision = {
    id: `ai-${transaction.id.slice(3)}`,
    transaction_id: transaction.id,
    recommended_strategy: output.recommended_strategy,
    confidence_score: output.confidence,
    diagnosis_code: output.diagnosis.primary_reason,
    concise_rationale: output.decision_explanation,
    suggested_delay_minutes: 0,
    suggested_discount_pct: 0,
    model_name: provider.name,
    latency_ms: latencyMs,
    raw_llm_response: {
      diagnosis: output.diagnosis,
      expected_recovery_value: output.expected_recovery_value,
    },
    created_at: new Date().toISOString(),
  };

  // Persist decision into in-memory/database store
  inMemoryStore.insertAIDecision(decisionRecord);

  // Update transaction status
  inMemoryStore.updateTransaction(transaction.id, {
    status: 'DIAGNOSED',
  });

  logger.info(`[AI Decision] Diagnosis completed for ${transaction.original_reference_id}`, {
    strategy: decisionRecord.recommended_strategy,
    confidence: decisionRecord.confidence_score,
    latencyMs,
  });

  return decisionRecord;
}