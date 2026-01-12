import Anthropic from '@anthropic-ai/sdk';
import { AIRequest, AIResponse } from '@/types';
import { AIProvider, ModelInfo } from './types';
import { logger } from '@/lib/logger';

const log = logger.ai.child({ provider: 'claude' });

export class ClaudeProvider implements AIProvider {
  readonly type = 'claude' as const;
  readonly name = 'Claude';
  private client: Anthropic | null = null;
  private model: string;

  constructor(model: string = 'claude-sonnet-4-20250514') {
    this.model = model;
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
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
      const models = response.data
        .filter((model) => model.type === 'model')
        .map((model) => ({
          id: model.id,
          name: model.display_name || model.id,
          createdAt: model.created_at ? new Date(model.created_at).getTime() : 0,
        }));

      // 最新モデルを上に（created_at降順）
      return models
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ id, name }) => ({ id, name }));
    } catch (error) {
      log.error('Failed to list models', error);
      return [];
    }
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.client) {
      return {
        content: '',
        provider: this.type,
        error: 'ANTHROPIC_API_KEY is not configured',
      };
    }

    const startTime = Date.now();
    log.info('Generate started', { model: this.model });

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === 'text');
      const content = textBlock && 'text' in textBlock ? textBlock.text : '';
      const duration = Date.now() - startTime;

      log.info('Generate completed', { model: this.model, contentLength: content.length, duration });

      return {
        content,
        provider: this.type,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Generate failed', error, { model: this.model, duration });
      return {
        content: '',
        provider: this.type,
        error: `Claude API error: ${errorMessage}`,
      };
    }
  }
}
