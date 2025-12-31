import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIRequest, AIResponse } from '@/types';
import { AIProvider, ModelInfo } from './types';

export class GeminiProvider implements AIProvider {
  readonly type = 'gemini' as const;
  readonly name = 'Gemini';
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;
  private model: string;

  constructor(model: string = 'gemini-1.5-flash') {
    this.model = model;
    if (process.env.GOOGLE_AI_API_KEY) {
      this.apiKey = process.env.GOOGLE_AI_API_KEY;
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      // Google AI API でモデル一覧を取得
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      // モデル名からバージョン番号を抽出してソート用の数値を返す
      const getModelVersion = (name: string): number => {
        // gemini-X.Y 形式からバージョン番号を抽出 (例: gemini-2.5-flash → 2.5)
        const versionMatch = name.match(/gemini-(\d+(?:\.\d+)?)/);
        if (versionMatch) {
          return parseFloat(versionMatch[1]);
        }
        // 実験版は高優先度として扱う
        if (name.includes('exp')) return 999;
        return 0;
      };

      const models = (data.models || [])
        .filter((model: { name: string; supportedGenerationMethods?: string[] }) =>
          model.supportedGenerationMethods?.includes('generateContent')
        )
        .map((model: { name: string; displayName?: string }) => ({
          id: model.name.replace('models/', ''),
          name: model.displayName || model.name.replace('models/', ''),
          priority: getModelVersion(model.name),
        }));

      // 優先度降順でソート
      return models
        .sort((a: { priority: number; id: string }, b: { priority: number; id: string }) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return b.id.localeCompare(a.id);
        })
        .map(({ id, name }: { id: string; name: string }) => ({ id, name }));
    } catch (error) {
      console.error('Failed to list Gemini models:', error);
      return [];
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.client) {
      return {
        content: '',
        provider: this.type,
        error: 'GOOGLE_AI_API_KEY is not configured',
      };
    }

    try {
      const generativeModel = this.client.getGenerativeModel({ model: this.model });
      const result = await generativeModel.generateContent(request.prompt);
      const response = await result.response;
      const content = response.text();

      return {
        content,
        provider: this.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        provider: this.type,
        error: `Gemini API error: ${errorMessage}`,
      };
    }
  }
}
