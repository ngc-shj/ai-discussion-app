/**
 * 検索結果の関連性フィルタリングとコンテンツ抽出（AIベース）
 *
 * AIを使用してトピックとの関連性を判定し、無関係な結果を除外する
 * 関連する場合は、トピックに関係する部分のみを抽出して返す
 *
 * 注意: JinaのfullContentを活用する場合は、SearchConfigでfetchFullContent: trueを設定する
 */

import { SearchResult, AIProviderType } from '@/types';
import { SearchWarning } from './types';
import { createLowRelevanceWarning } from './warning-utils';
import { createProvider } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

const log = logger.search.child({ component: 'relevance-filter' });

export interface RelevanceFilterOptions {
  aiProvider?: AIProviderType;  // 使用するAIプロバイダー
  aiModel?: string;             // 使用するモデル
  threshold?: number;           // 関連性スコアの閾値（0-1、デフォルト0.5）
}

export interface RelevanceFilterResult {
  results: SearchResult[];
  filteredCount: number;
  warning?: SearchWarning;
}

interface AIRelevanceJudgment {
  relevant: boolean;
  score: number;
  reason: string;
  extractedContent?: string;  // 関連する部分のみ抽出したコンテンツ
}

/**
 * AIを使用して単一の検索結果の関連性を判定し、関連部分を抽出
 */
async function judgeAndExtractWithAI(
  result: SearchResult,
  topic: string,
  provider: AIProviderType,
  model?: string
): Promise<AIRelevanceJudgment> {
  const aiProvider = createProvider(provider, model);

  // fullContentがある場合はそれを使用、なければcontentを使用
  const contentToAnalyze = result.fullContent || result.content;
  // 長すぎる場合は切り詰め（トークン制限対策）
  const truncatedContent = contentToAnalyze.slice(0, 8000);

  const prompt = `あなたは検索結果の関連性を判定し、関連部分を抽出する専門家です。

【トピック】
${topic}

【検索結果】
タイトル: ${result.title}
URL: ${result.url}
内容:
${truncatedContent}

【タスク】
1. この検索結果がトピックに関連しているかを判定してください
2. 特に以下の点に注意してください：
   - トピックに含まれる人名・組織名と、検索結果に含まれる人名・組織名が一致しているか
   - 同姓同名の別人や、名前が似ている別の人物・組織ではないか
   - 検索結果の内容がトピックの文脈に適切か
3. 関連している場合は、トピックに関係する重要な情報のみを抽出してください（最大1000文字程度）
   不要な情報（関係ない人物の話題、広告、ナビゲーション等）は除外してください

【回答形式】
以下のJSON形式のみで回答してください。説明は不要です。
{
  "relevant": true または false,
  "score": 0.0〜1.0の数値,
  "reason": "判定理由（50文字以内）",
  "extractedContent": "関連している場合のみ、トピックに関係する重要な情報を抽出（関連がない場合は空文字）"
}`;

  try {
    const response = await aiProvider.generate({ prompt });

    // JSONをパース
    const responseText = response.content.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        relevant: parsed.relevant ?? false,
        score: parsed.score ?? (parsed.relevant ? 0.7 : 0.2),
        reason: parsed.reason ?? '',
        extractedContent: parsed.extractedContent || undefined,
      };
    }
  } catch (error) {
    log.warn('AI relevance judgment failed', { title: result.title, error });
  }

  // パース失敗時またはエラー時はデフォルト値（エラー時は通過させる）
  return {
    relevant: true,
    score: 0.5,
    reason: 'AI判定エラー',
  };
}

/**
 * 関連性の低い検索結果をフィルタリングし、関連部分を抽出（AIベース）
 *
 * Jinaで取得したfullContentがある場合、それを使用して判定し、
 * 関連する部分のみを抽出してfullContentを置き換えます。
 */
export async function filterByRelevance(
  results: SearchResult[],
  topic: string,
  options: RelevanceFilterOptions = {}
): Promise<RelevanceFilterResult> {
  const {
    aiProvider = 'claude',
    aiModel,
    threshold = 0.5,
  } = options;

  if (results.length === 0) {
    return { results: [], filteredCount: 0 };
  }

  log.info('Starting AI-based relevance filtering', {
    topic,
    resultCount: results.length,
    provider: aiProvider,
    threshold,
    hasFullContent: results.some(r => !!r.fullContent),
  });

  const filteredResults: SearchResult[] = [];
  let filteredCount = 0;

  // 各結果を順次処理（並列だとレートリミットにかかりやすい）
  for (const result of results) {
    const judgment = await judgeAndExtractWithAI(result, topic, aiProvider, aiModel);

    log.debug('AI relevance judgment', {
      title: result.title,
      relevant: judgment.relevant,
      score: judgment.score,
      reason: judgment.reason,
      hasExtracted: !!judgment.extractedContent,
    });

    if (judgment.score >= threshold && judgment.relevant) {
      // 関連している場合、抽出されたコンテンツがあれば使用
      const filteredResult: SearchResult = {
        ...result,
        // 関連性情報を追加
        relevance: {
          score: judgment.score,
          reason: judgment.reason,
          isExtracted: !!judgment.extractedContent,
        },
      };

      // 抽出されたコンテンツがある場合はfullContentを置き換え
      if (judgment.extractedContent) {
        filteredResult.fullContent = judgment.extractedContent;
      }

      filteredResults.push(filteredResult);
    } else {
      filteredCount++;
      log.info('Filtered out irrelevant result', {
        title: result.title,
        url: result.url,
        score: judgment.score,
        reason: judgment.reason,
      });
    }
  }

  log.info('Relevance filtering completed', {
    originalCount: results.length,
    filteredCount,
    remainingCount: filteredResults.length,
  });

  const warning = filteredCount > 0 ? createLowRelevanceWarning(filteredCount) : undefined;

  return {
    results: filteredResults,
    filteredCount,
    warning,
  };
}
