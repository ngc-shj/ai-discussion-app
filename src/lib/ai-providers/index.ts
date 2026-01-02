import { AIProviderType } from '@/types';
import { AIProvider, ModelInfo } from './types';
import { ClaudeProvider } from './claude';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

export { ClaudeProvider } from './claude';
export { OllamaProvider } from './ollama';
export { OpenAIProvider } from './openai';
export { GeminiProvider } from './gemini';
export { createDiscussionPrompt, createFollowUpPrompt, parseFollowUpResponse } from './types';
export type { AIProvider, ModelInfo } from './types';

// プロバイダーのファクトリー関数
export function createProvider(type: AIProviderType, model?: string): AIProvider {
  switch (type) {
    case 'claude':
      return new ClaudeProvider(model);
    case 'ollama':
      return new OllamaProvider(model);
    case 'openai':
      return new OpenAIProvider(model);
    case 'gemini':
      return new GeminiProvider(model);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

// 全プロバイダーの可用性をチェック
export async function checkProviderAvailability(): Promise<Record<AIProviderType, boolean>> {
  const providers: AIProviderType[] = ['claude', 'ollama', 'openai', 'gemini'];
  const results: Record<string, boolean> = {};

  await Promise.all(
    providers.map(async (type) => {
      const provider = createProvider(type);
      results[type] = await provider.isAvailable();
    })
  );

  return results as Record<AIProviderType, boolean>;
}

// 全プロバイダーのモデル一覧を取得
export async function listAllModels(): Promise<Record<AIProviderType, ModelInfo[]>> {
  const providers: AIProviderType[] = ['claude', 'ollama', 'openai', 'gemini'];
  const results: Record<string, ModelInfo[]> = {};

  await Promise.all(
    providers.map(async (type) => {
      const provider = createProvider(type);
      results[type] = await provider.listModels();
    })
  );

  return results as Record<AIProviderType, ModelInfo[]>;
}
