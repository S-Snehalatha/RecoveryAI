import { Transaction } from '@/types';
import { AIOutput } from './schemas';
import { DemoAIProvider } from './demo';
import { AnthropicAIProvider } from './anthropic';
import { env } from '@/lib/config/env';

export interface IAIProvider {
  readonly name: string;
  diagnose(transaction: Transaction): Promise<AIOutput>;
}

let cachedProvider: IAIProvider | null = null;

export function getAIProvider(): IAIProvider {
  if (cachedProvider) return cachedProvider;

  if (env.AI_PROVIDER === 'ANTHROPIC' && env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim() !== '') {
    try {
      cachedProvider = new AnthropicAIProvider(env.ANTHROPIC_API_KEY);
      return cachedProvider;
    } catch (err) {
      console.warn('⚠️ Failed to initialize AnthropicAIProvider, falling back to DemoAIProvider:', err);
    }
  }

  cachedProvider = new DemoAIProvider();
  return cachedProvider;
}