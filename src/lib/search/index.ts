import { SearchResult, SearchConfig } from '@/types';
import { enrichSearchResultsWithContent } from './jina-reader';
import {
  SearchProvider,
  ISearchProvider,
  SearchProviderInfo,
  SearchProviderParams,
  SearchWarning,
} from './types';
import { createWarningFromError } from './warning-utils';
import { filterByRelevance, SearchContext } from './relevance-filter';
import { getSearchResultsFromCache, setSearchResultsToCache } from './cache';
import {
  SearXNGProvider,
  TavilyProvider,
  DuckDuckGoProvider,
  BraveSearchProvider,
  SerperProvider,
} from './providers';
import { logger } from '@/lib/logger';

const log = logger.search;

// 型定義のエクスポート
export * from './types';
export type { SearchContext } from './relevance-filter';
export { clearSearchCache, clearRelevanceCache, clearAllSearchCaches, getCacheStats } from './cache';

// プロバイダーのエクスポート
export * from './providers';

/**
 * 検索プロバイダーのインスタンスを取得
 */
export function getSearchProvider(
  provider: SearchProvider,
  engines?: string[]
): ISearchProvider {
  switch (provider) {
    case 'searxng':
      return new SearXNGProvider(engines);
    case 'tavily':
      return new TavilyProvider();
    case 'duckduckgo':
      return new DuckDuckGoProvider();
    case 'brave':
      return new BraveSearchProvider();
    case 'serper':
      return new SerperProvider();
    default:
      throw new Error(`Unknown search provider: ${provider}`);
  }
}

/**
 * 利用可能な検索プロバイダーの一覧を取得
 */
export function getAvailableSearchProviders(): SearchProviderInfo[] {
  const providers: SearchProviderInfo[] = [
    {
      id: 'searxng',
      name: 'SearXNG',
      description: 'セルフホスト型メタ検索エンジン',
      requiresApiKey: false,
      available: !!process.env.SEARXNG_BASE_URL,
    },
    {
      id: 'tavily',
      name: 'Tavily',
      description: 'AI向け最適化検索API',
      requiresApiKey: true,
      available: !!process.env.TAVILY_API_KEY,
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      description: 'プライバシー重視（APIキー不要）',
      requiresApiKey: false,
      available: true,
    },
    {
      id: 'brave',
      name: 'Brave Search',
      description: '独自インデックスのプライバシー検索',
      requiresApiKey: true,
      available: !!process.env.BRAVE_SEARCH_API_KEY,
    },
    {
      id: 'serper',
      name: 'Serper (Google)',
      description: 'Google検索結果をAPI経由で取得',
      requiresApiKey: true,
      available: !!process.env.SERPER_API_KEY,
    },
  ];

  return providers;
}

/**
 * デフォルトの検索プロバイダーを取得
 * 優先順位: Tavily > SearXNG > Serper > Brave > DuckDuckGo
 */
export function getDefaultSearchProvider(): SearchProvider {
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.SEARXNG_BASE_URL) return 'searxng';
  if (process.env.SERPER_API_KEY) return 'serper';
  if (process.env.BRAVE_SEARCH_API_KEY) return 'brave';
  return 'duckduckgo'; // フォールバック
}

// ========================================
// 後方互換性のための既存API
// ========================================

export interface SearchParams {
  query: string;
  searchType?: 'web' | 'news' | 'images';
  maxResults?: number;
  language?: string;
  engines?: string[];
  provider?: SearchProvider;
}

/**
 * 検索結果を取得（プロバイダー対応版）
 */
export async function fetchSearchResults(params: SearchParams): Promise<{
  results: SearchResult[];
  query: string;
  totalResults: number;
  provider: SearchProvider;
  warnings?: SearchWarning[];
  fromCache?: boolean;
}> {
  const provider = params.provider || getDefaultSearchProvider();

  // キャッシュをチェック
  const cachedResults = getSearchResultsFromCache(params.query, provider, params.maxResults);
  if (cachedResults) {
    log.info('Cache hit (search)', { query: params.query, resultCount: cachedResults.length });
    return {
      results: cachedResults,
      query: params.query,
      totalResults: cachedResults.length,
      provider,
      fromCache: true,
    };
  }

  const searchProvider = getSearchProvider(provider, params.engines);

  const providerParams: SearchProviderParams = {
    query: params.query,
    maxResults: params.maxResults || 5,
    language: params.language || 'ja',
    searchType: params.searchType || 'web',
  };

  const response = await searchProvider.search(providerParams);

  const results: SearchResult[] = response.results.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    publishedDate: result.publishedDate,
  }));

  // キャッシュに保存
  if (results.length > 0) {
    setSearchResultsToCache(params.query, results, provider, params.maxResults);
  }

  return {
    results,
    query: response.query,
    totalResults: results.length,
    provider: response.provider,
    warnings: response.warnings,
  };
}

/**
 * 関連性フィルタリングで使用するAIのデフォルト設定
 */
export interface DefaultAIConfig {
  provider: string;
  model?: string;
}

/**
 * SearchConfigを使用してWeb検索を実行（discussion-engine用）
 *
 * 処理順序:
 * 1. 検索プロバイダーで検索
 * 2. Jinaで詳細コンテンツを取得（fetchFullContent: trueの場合）
 * 3. AIで関連性フィルタリング+コンテンツ抽出（relevanceFilter.enabled: trueの場合）
 *
 * @param query 検索クエリ
 * @param config 検索設定
 * @param topic 関連性フィルタリング用のトピック
 * @param defaultAI 関連性フィルタリング用のデフォルトAI設定（最初の参加者のプロバイダー/モデルを使用）
 * @param searchContext 検索コンテキスト（検索タイミングとキーワード）
 */
export async function performSearch(
  query: string,
  config: SearchConfig,
  topic?: string,
  defaultAI?: DefaultAIConfig,
  searchContext?: SearchContext
): Promise<{ results: SearchResult[]; warnings?: SearchWarning[] }> {
  try {
    const { results, warnings = [] } = await fetchSearchResults({
      query,
      searchType: config.searchType,
      maxResults: config.maxResults,
      language: config.language || 'ja',
      engines: config.engines,
      provider: config.provider,
    });

    let processedResults = results;
    const allWarnings = [...warnings];

    // Step 1: 詳細コンテンツを取得（Jina Reader）
    // 関連性フィルタリングで詳細コンテンツを使いたいので先に取得
    if (config.fetchFullContent && processedResults.length > 0) {
      processedResults = await enrichSearchResultsWithContent(
        processedResults,
        { apiKey: process.env.JINA_API_KEY },
        config.fullContentMaxResults || 3
      );
    }

    // Step 2: 関連性フィルタリング（AIベース）
    // fullContentがある場合はそれを使って判定し、関連部分のみを抽出
    if (config.relevanceFilter?.enabled && topic && processedResults.length > 0) {
      // AIプロバイダー: defaultAI（サポートエージェント）> config > 'claude' の優先順位
      // サポートエージェントが指定されている場合は最優先で使用
      const aiProvider = (defaultAI?.provider || config.relevanceFilter.aiProvider || 'claude') as 'claude' | 'openai' | 'ollama' | 'gemini';
      const aiModel = defaultAI?.model || config.relevanceFilter.aiModel;

      const filterResult = await filterByRelevance(processedResults, topic, {
        threshold: config.relevanceFilter.threshold,
        aiProvider,
        aiModel,
        searchContext,
      });
      processedResults = filterResult.results;
      if (filterResult.warning) {
        allWarnings.push(filterResult.warning);
      }
    }

    return { results: processedResults, warnings: allWarnings.length > 0 ? allWarnings : undefined };
  } catch (error) {
    const warning = (error as Error & { warning?: SearchWarning }).warning || createWarningFromError(error);
    log.error('Search failed', error, { query, provider: config.provider, warning: warning.type });
    return { results: [], warnings: [warning] };
  }
}

/**
 * 新しい検索結果を既存の検索結果と統合（重複除去）
 */
export function mergeSearchResults(
  existing: SearchResult[],
  newResults: SearchResult[]
): SearchResult[] {
  const existingUrls = new Set(existing.map(r => r.url));
  const uniqueNewResults = newResults.filter(r => !existingUrls.has(r.url));
  return [...existing, ...uniqueNewResults];
}
