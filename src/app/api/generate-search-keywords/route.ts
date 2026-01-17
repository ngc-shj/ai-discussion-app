import { NextRequest, NextResponse } from 'next/server';
import { createProvider } from '@/lib/ai-providers';
import { createSearchKeywordPrompt, SearchKeywordTiming } from '@/lib/ai-providers/prompt-formatters';
import { DiscussionParticipant } from '@/types';
import { logger } from '@/lib/logger';

const log = logger.api.child({ route: '/api/generate-search-keywords' });

interface GenerateKeywordsRequest {
  topic: string;
  messages?: Array<{ provider: string; content: string }>;
  timing: SearchKeywordTiming;
  participant?: DiscussionParticipant;
  maxKeywords?: number; // キーワードの最大数（デフォルト1）
}

/**
 * AIの応答からJSONキーワード配列をパース
 */
function parseKeywordsResponse(content: string): string[] {
  // JSONブロックを抽出（```json ... ``` または 単独の [...] ）
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    content.match(/\[[\s\S]*?\]/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr.trim());
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
    } catch {
      // パース失敗時はフォールバック
    }
  }

  // フォールバック: 行ごとに分割してキーワードを抽出
  const lines = content.split('\n')
    .map(line => line.replace(/^[-*\d.]+\s*/, '').trim())
    .filter(line => line.length > 0 && line.length < 100);

  return lines.slice(0, 5);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: GenerateKeywordsRequest = await request.json();
    const { topic, messages, timing, participant, maxKeywords = 1 } = body;

    if (!topic) {
      log.warn('Missing topic parameter');
      return NextResponse.json(
        { error: 'トピックが指定されていません' },
        { status: 400 }
      );
    }

    log.info('Generate keywords request received', { topic, timing, maxKeywords });

    // プロンプトを生成（maxKeywordsを渡す）
    const prompt = createSearchKeywordPrompt(topic, messages, timing, maxKeywords);

    // 参加者が指定されていればそのプロバイダーを使用、なければデフォルト
    let provider;
    if (participant) {
      provider = createProvider(participant.provider, participant.model);
    } else {
      // デフォルトはOllama（ローカルで高速）、なければClaudeを試行
      try {
        provider = createProvider('ollama');
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          provider = createProvider('claude');
        }
      } catch {
        provider = createProvider('claude');
      }
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'AIプロバイダーが利用できません' },
        { status: 503 }
      );
    }

    const response = await provider.generate({ prompt });

    if (response.error) {
      return NextResponse.json(
        { error: response.error },
        { status: 500 }
      );
    }

    // AIが指定より多くのキーワードを返すことがあるため、明示的に制限
    const keywords = parseKeywordsResponse(response.content).slice(0, maxKeywords);
    const duration = Date.now() - startTime;

    log.info('Keywords generated', { topic, keywordCount: keywords.length, duration });

    return NextResponse.json({
      keywords,
      rawResponse: response.content,
      prompt, // AIに渡されたプロンプト（確認用）
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Generate keywords failed', error, { duration });
    return NextResponse.json(
      {
        error: '検索キーワードの生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
