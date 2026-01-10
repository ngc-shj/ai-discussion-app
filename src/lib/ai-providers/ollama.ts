import { AIRequest, AIResponse } from '@/types';
import { AIProvider, ModelInfo, StreamChunkCallback } from './types';

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
    // 内部的にgenerateStreamを使用（コールバックなし）
    return this.generateStream(request, () => {});
  }

  async generateStream(
    request: AIRequest,
    onChunk: StreamChunkCallback
  ): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: request.prompt,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let content = '';
      let thinking = ''; // 思考内容を別途蓄積
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // 改行で分割し、完全な行のみ処理
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 最後の不完全な行はバッファに残す

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            // responseがあれば使用
            if (json.response) {
              content += json.response;
              onChunk(json.response); // リアルタイムコールバック
            }
            // thinkingも蓄積（フォールバック用）
            if (json.thinking) {
              thinking += json.thinking;
            }
          } catch {
            // JSON パースエラーは無視（不完全な行の可能性）
          }
        }
      }

      // バッファに残った最後の行を処理
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer);
          if (json.response) {
            content += json.response;
            onChunk(json.response);
          }
          if (json.thinking) {
            thinking += json.thinking;
          }
        } catch {
          // 無視
        }
      }

      // responseが空でthinkingがある場合、thinkingをフォールバックとして使用
      const finalContent = content || thinking;
      return {
        content: finalContent,
        provider: this.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        provider: this.type,
        error: `Ollama API error: ${errorMessage}`,
      };
    }
  }
}
