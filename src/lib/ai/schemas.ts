import { z } from 'zod';

export const AIStrategyEnum = z.enum([
  'retry_payment',
  'send_payment_link',
  'retry_mandate',
  'escalate_receivables',
  'human_review',
  'no_action',
]);

export const DiagnosisSchema = z.object({
  primary_reason: z.string().min(1, 'Primary reason is required').max(100),
  explanation: z.string().min(1, 'Explanation is required').max(500),
});

export const AIOutputSchema = z.object({
  diagnosis: DiagnosisSchema,
  recommended_strategy: AIStrategyEnum,
  confidence: z.number().min(0.0, 'Confidence must be >= 0.0').max(1.0, 'Confidence must be <= 1.0'),
  expected_recovery_value: z.number().nonnegative('Expected recovery value must be non-negative'),
  decision_explanation: z.string().min(1, 'Decision explanation is required').max(500),
});

export type AIOutput = z.infer<typeof AIOutputSchema>;

/**
 * Generates a safe fallback AI decision when the LLM outputs malformed JSON,
 * an invalid strategy, out-of-range confidence, or when prompt injection is detected.
 */
export function createFallbackAIDecision(
  reason = 'AI_OUTPUT_VALIDATION_FAILURE',
  explanation = 'AI model response did not pass deterministic validation schema. Routed to human review.'
): AIOutput {
  return {
    diagnosis: {
      primary_reason: reason,
      explanation: explanation,
    },
    recommended_strategy: 'human_review',
    confidence: 0.0,
    expected_recovery_value: 0.0,
    decision_explanation: 'Automatic failsafe triggered: AI recommendation redirected to Human Review queue.',
  };
}

export function validateAIOutput(raw: unknown): { success: true; data: AIOutput } | { success: false; error: string; fallback: AIOutput } {
  if (typeof raw === 'string') {
    try {
      const cleanJson = raw.replace(/```json\s*|\s*```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return validateAIOutput(parsed);
    } catch {
      return {
        success: false,
        error: 'JSON_PARSE_ERROR: Output is not valid JSON string',
        fallback: createFallbackAIDecision('INVALID_JSON_RESPONSE', 'Failed to parse model output into valid JSON.'),
      };
    }
  }

  const result = AIOutputSchema.safeParse(raw);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return {
      success: false,
      error: `SCHEMA_VALIDATION_ERROR: ${errorMsg}`,
      fallback: createFallbackAIDecision('SCHEMA_VALIDATION_FAILURE', errorMsg),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}