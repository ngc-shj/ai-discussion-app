// AIプロバイダーの種類
export type AIProviderType = 'claude' | 'ollama' | 'openai' | 'gemini';

// モデル情報
export interface ModelInfo {
  id: string;
  name: string;
}

// AIプロバイダーの設定
export interface AIProviderConfig {
  id: AIProviderType;
  name: string;
  color: string;
  defaultModel: string;
}

// プロバイダーのデフォルト設定
export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    color: '#D97706',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#059669',
    defaultModel: 'gpt-oss:20b',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    color: '#10B981',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285F4',
    defaultModel: 'gemini-1.5-flash',
  },
];

// Ollamaモデル用の色を生成
export function getOllamaModelColor(modelId: string): string {
  const colors = ['#059669', '#0D9488', '#0891B2', '#0284C7', '#2563EB', '#4F46E5', '#7C3AED', '#9333EA'];
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    hash = modelId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// AIプロバイダーへのリクエスト
export interface AIRequest {
  prompt: string;
  context?: string;
  previousMessages?: Array<{
    provider: string;
    content: string;
  }>;
}

// AIプロバイダーからのレスポンス
export interface AIResponse {
  content: string;
  provider: AIProviderType;
  error?: string;
}
