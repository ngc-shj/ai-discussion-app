import { AIRequest, AIResponse } from '@/types';
import { AIProvider, ModelInfo } from './types';

export class OllamaProvider implements AIProvider {
  readonly type = 'ollama' as const;
  readonly name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(
    model: string = 'gpt-oss:20b',
    baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  ) {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const models = (data.models || []).map((model: { name: string; model?: string; modified_at?: string }) => ({
        id: model.name,
        name: model.name,
        modifiedAt: model.modified_at ? new Date(model.modified_at).getTime() : 0,
      }));

      // 最終更新日時の降順でソート（新しいものが上）
      return models
        .sort((a: { modifiedAt: number }, b: { modifiedAt: number }) => b.modifiedAt - a.modifiedAt)
        .map(({ id, name }: { id: string; name: string }) => ({ id, name }));
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    try {
      // 3分のタイムアウトを設定（大きなモデルの場合時間がかかるため）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: request.prompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        content: data.response || '',
        provider: this.type,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          content: '',
          provider: this.type,
          error: 'Ollama API timeout (180s exceeded)',
        };
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        provider: this.type,
        error: `Ollama API error: ${errorMessage}`,
      };
    }
  }
}
