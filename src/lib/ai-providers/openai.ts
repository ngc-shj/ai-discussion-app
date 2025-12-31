import OpenAI from 'openai';
import { AIRequest, AIResponse } from '@/types';
import { AIProvider, ModelInfo } from './types';

export class OpenAIProvider implements AIProvider {
  readonly type = 'openai' as const;
  readonly name = 'ChatGPT';
  private client: OpenAI | null = null;
  private model: string;

  constructor(model: string = 'gpt-4o-mini') {
    this.model = model;
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.client) {
      return [];
    }

    try {
      const response = await this.client.models.list();
      // GPT系のモデルのみをフィルタリング
      const models = response.data
        .filter((model) =>
          model.id.startsWith('gpt-') ||
          model.id.startsWith('o1') ||
          model.id.startsWith('o3') ||
          model.id.startsWith('o4')
        )
        .map((model) => ({
          id: model.id,
          name: model.id,
          created: model.created,
        }));

      // 最新モデルを上に（created降順）、同じcreatedならid降順
      return models
        .sort((a, b) => {
          if (b.created !== a.created) {
            return b.created - a.created;
          }
          return b.id.localeCompare(a.id);
        })
        .map(({ id, name }) => ({ id, name }));
    } catch (error) {
      console.error('Failed to list OpenAI models:', error);
      return [];
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.client) {
      return {
        content: '',
        provider: this.type,
        error: 'OPENAI_API_KEY is not configured',
      };
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        max_tokens: 1024,
      });

      const content = completion.choices[0]?.message?.content || '';

      return {
        content,
        provider: this.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        provider: this.type,
        error: `OpenAI API error: ${errorMessage}`,
      };
    }
  }
}
