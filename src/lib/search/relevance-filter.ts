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
import { createProvider, escapeXmlAttr, escapeXmlContent } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';
import { getRelevanceFromCache, setRelevanceToCache } from './cache';

const log = logger.search.child({ component: 'relevance-filter' });

/**
 * 検索コンテキスト - 検索タイミングと検索キーワードを保持
 */
export interface SearchContext {
  /** 検索タイミング: 'start'=議論開始時, 'round'=ラウンド中, 'summary'=統合回答前 */
  timing: 'start' | 'round' | 'summary';
  /** 実際の検索キーワード（ラウンド検索や統合前検索で使用） */
  searchKeywords?: string[];
}

export interface RelevanceFilterOptions {
  aiProvider?: AIProviderType;  // 使用するAIプロバイダー
  aiModel?: string;             // 使用するモデル
  threshold?: number;           // 関連性スコアの閾値（0-1、デフォルト0.5）
  searchContext?: SearchContext; // 検索コンテキスト（検索タイミングとキーワード）
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
 * 検索タイミングに応じたプロンプトを生成
 */
function buildRelevancePrompt(
  result: SearchResult,
  topic: string,
  contentToAnalyze: string,
  searchContext?: SearchContext
): string {
  const timing = searchContext?.timing || 'start';
  const searchKeywords = searchContext?.searchKeywords?.join('、') || '';

  // 検索コンテキストセクション（ラウンド・統合前検索時のみ）
  const contextSection = timing !== 'start' && searchKeywords
    ? `【検索コンテキスト】
- 検索タイプ: ${timing === 'round' ? 'ラウンド検索（議論中の深掘り検索）' : '統合検索（統合回答前の補足検索）'}
- 検索キーワード: 「${searchKeywords}」
- 元のトピック: 「${topic}」

`
    : '';

  // 判定基準セクション（検索タイプに応じて変更）
  const criteriaSection = timing === 'start'
    ? `【判定基準】
この検索結果がトピックに関連しているかを判定してください。
特に以下の点に注意してください：
- トピックに含まれる人名・組織名と、検索結果に含まれる人名・組織名が一致しているか
- 同姓同名の別人や、名前が似ている別の人物・組織ではないか
- 検索結果の内容がトピックの文脈に適切か`
    : `【判定基準】
この検索は${timing === 'round' ? 'ラウンド検索' : '統合検索'}のため、**検索キーワードとの関連性を主に評価**してください。
- 検索キーワード「${searchKeywords}」に関する情報が含まれているか
- 検索キーワードの文脈で有用な情報があるか
- 元のトピック「${topic}」との直接的な関連は必須ではありませんが、あれば加点要素です`;

  // トピックセクション（開始時検索のみ表示、それ以外は検索コンテキストで表示済み）
  const topicSection = timing === 'start'
    ? `【トピック】
${topic}

`
    : '';

  return `あなたは検索結果の関連性を判定し、関連部分を抽出する専門家です。

${contextSection}${topicSection}<search_result>
<title>${escapeXmlContent(result.title)}</title>
<url>${escapeXmlAttr(result.url)}</url>
<content>
${escapeXmlContent(contentToAnalyze)}
</content>
</search_result>

${criteriaSection}

【タスク】
1. 上記の判定基準に従って、この検索結果の関連性を判定してください
2. 関連している場合は、${timing === 'start' ? 'トピック' : '検索キーワード'}に関係する重要な情報のみを抽出してください（最大3000文字程度）
   不要な情報（関係ない人物の話題、広告、ナビゲーション等）は除外してください

【回答形式】
以下のJSON形式のみで回答してください。説明は不要です。
{
  "relevant": true または false,
  "score": 0.0〜1.0の数値,
  "reason": "判定理由（50文字以内）",
  "extractedContent": "関連している場合のみ、重要な情報を抽出（関連がない場合は空文字）"
}`;
}

/**
 * AIを使用して単一の検索結果の関連性を判定し、関連部分を抽出
 */
async function judgeAndExtractWithAI(
  result: SearchResult,
  topic: string,
  provider: AIProviderType,
  model?: string,
  searchContext?: SearchContext
): Promise<AIRelevanceJudgment> {
  // キャッシュをチェック
  const cached = getRelevanceFromCache(result.url, topic, searchContext?.searchKeywords);
  if (cached) {
    log.info('Cache hit (relevance)', { url: result.url, score: cached.score });
    return cached;
  }

  const aiProvider = createProvider(provider, model);

  // fullContentがある場合はそれを使用、なければcontentを使用
  const contentToAnalyze = result.fullContent || result.content;

  const prompt = buildRelevancePrompt(result, topic, contentToAnalyze, searchContext);

  try {
    const response = await aiProvider.generate({ prompt });

    // JSONをパース
    const responseText = response.content.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const judgment: AIRelevanceJudgment = {
        relevant: parsed.relevant ?? false,
        score: parsed.score ?? (parsed.relevant ? 0.7 : 0.2),
        reason: parsed.reason ?? '',
        extractedContent: parsed.extractedContent || undefined,
      };

      // キャッシュに保存
      setRelevanceToCache(result.url, topic, judgment, searchContext?.searchKeywords);

      return judgment;
    }
  } catch (error) {
    log.warn('AI relevance judgment failed', { title: result.title, error });
  }

  // パース失敗時またはエラー時はデフォルト値（エラー時は通過させる）
  // エラー時はキャッシュしない
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
    aiProvider = 'claude',  // デフォルトはclaude（呼び出し側で最初の参加者のプロバイダーを渡すことを推奨）
    aiModel,
    threshold = 0.5,
    searchContext,
  } = options;

  if (results.length === 0) {
    return { results: [], filteredCount: 0 };
  }

  log.info('Starting AI-based relevance filtering', {
    topic,
    resultCount: results.length,
    provider: aiProvider,
    model: aiModel,
    threshold,
    hasFullContent: results.some(r => !!r.fullContent),
    searchTiming: searchContext?.timing || 'start',
    searchKeywords: searchContext?.searchKeywords,
  });

  const allResults: SearchResult[] = [];
  let filteredCount = 0;

  // 各結果を順次処理（並列だとレートリミットにかかりやすい）
  for (const result of results) {
    const judgment = await judgeAndExtractWithAI(result, topic, aiProvider, aiModel, searchContext);

    log.debug('AI relevance judgment', {
      title: result.title,
      relevant: judgment.relevant,
      score: judgment.score,
      reason: judgment.reason,
      hasExtracted: !!judgment.extractedContent,
    });

    const isFiltered = !(judgment.score >= threshold && judgment.relevant);

    // すべての結果に関連性情報を追加（除外されたものも含む）
    const processedResult: SearchResult = {
      ...result,
      relevance: {
        score: judgment.score,
        reason: judgment.reason,
        isExtracted: !!judgment.extractedContent,
      },
      filtered: isFiltered, // 除外フラグ
    };

    // 関連している場合、抽出されたコンテンツがあれば使用
    if (!isFiltered && judgment.extractedContent) {
      // 元の全文を保存してから、要約で上書き
      if (result.fullContent) {
        processedResult.originalFullContent = result.fullContent;
      }
      processedResult.fullContent = judgment.extractedContent;
    }

    if (isFiltered) {
      filteredCount++;
      log.info('Marked as low relevance', {
        title: result.title,
        url: result.url,
        score: judgment.score,
        reason: judgment.reason,
      });
    }

    allResults.push(processedResult);
  }

  log.info('Relevance filtering completed', {
    originalCount: results.length,
    filteredCount,
    relevantCount: allResults.length - filteredCount,
  });

  const warning = filteredCount > 0 ? createLowRelevanceWarning(filteredCount) : undefined;

  return {
    results: allResults, // 除外されたものもfiltered: trueで含む
    filteredCount,
    warning,
  };
}
