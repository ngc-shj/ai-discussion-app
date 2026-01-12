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
}> {
  const provider = params.provider || getDefaultSearchProvider();
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

  return {
    results,
    query: response.query,
    totalResults: results.length,
    provider: response.provider,
    warnings: response.warnings,
  };
}

/**
 * SearchConfigを使用してWeb検索を実行（discussion-engine用）
 */
export async function performSearch(
  query: string,
  config: SearchConfig
): Promise<{ results: SearchResult[]; warnings?: SearchWarning[] }> {
  try {
    const { results, warnings } = await fetchSearchResults({
      query,
      searchType: config.searchType,
      maxResults: config.maxResults,
      language: config.language || 'ja',
      engines: config.engines,
      provider: config.provider,
    });

    // 詳細コンテンツを取得
    if (config.fetchFullContent && results.length > 0) {
      const enrichedResults = await enrichSearchResultsWithContent(
        results,
        { apiKey: process.env.JINA_API_KEY },
        config.fullContentMaxResults || 3
      );
      return { results: enrichedResults, warnings };
    }

    return { results, warnings };
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
