import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider } from './provider';
import { AIOutput, validateAIOutput, createFallbackAIDecision } from './schemas';
import { RECOVERAI_SYSTEM_PROMPT, buildDiagnosticUserPrompt } from './prompts';
import { Transaction } from '@/types';
import { env } from '@/lib/config/env';

export class AnthropicAIProvider implements IAIProvider {
  public readonly name = 'Anthropic Claude (claude-3-5-sonnet-20241022)';
  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not configured in environment.');
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async diagnose(transaction: Transaction): Promise<AIOutput> {
    try {
      const userPrompt = buildDiagnosticUserPrompt(transaction);

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.1,
        system: RECOVERAI_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const responseBlock = message.content[0];
      if (!responseBlock || responseBlock.type !== 'text') {
        return createFallbackAIDecision(
          'EMPTY_MODEL_RESPONSE',
          'Anthropic model did not return a valid text response block.'
        );
      }

      const validated = validateAIOutput(responseBlock.text);
      if (!validated.success) {
        console.warn(`[AI Decision Warning] Validation fallback: ${validated.error}`);
        return validated.fallback;
      }

      return validated.data;
    } catch (err) {
      console.error('[Anthropic AI Provider Error]:', err);
      return createFallbackAIDecision(
        'API_CALL_ERROR',
        err instanceof Error ? err.message : 'Unknown network/API error from Anthropic.'
      );
    }
  }
}