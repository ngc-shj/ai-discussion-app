import { SearchResult, SearchConfig } from '@/types';

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';

export interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
  publishedDate?: string;
  img_src?: string;
  thumbnail?: string;
}

export interface SearXNGResponse {
  results: SearXNGResult[];
  query: string;
  number_of_results: number;
}

export interface SearchParams {
  query: string;
  searchType?: 'web' | 'news' | 'images';
  maxResults?: number;
  language?: string;
  engines?: string[];
}

/**
 * SearXNGのURLを構築
 */
export function buildSearchUrl(params: SearchParams): URL {
  const { query, searchType = 'web', language = 'ja', engines } = params;

  const url = new URL('/search', SEARXNG_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', language);

  if (searchType === 'news') {
    url.searchParams.set('categories', 'news');
  } else if (searchType === 'images') {
    url.searchParams.set('categories', 'images');
  } else {
    url.searchParams.set('categories', 'general');
  }

  if (engines && engines.length > 0) {
    url.searchParams.set('engines', engines.join(','));
  }

  return url;
}

/**
 * SearXNGから検索結果を取得
 */
export async function fetchSearchResults(params: SearchParams): Promise<{
  results: SearchResult[];
  query: string;
  totalResults: number;
}> {
  const url = buildSearchUrl(params);
  const maxResults = params.maxResults || 5;

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`SearXNG returned status ${response.status}`);
  }

  const data: SearXNGResponse = await response.json();

  const results: SearchResult[] = data.results
    .slice(0, maxResults)
    .map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content || '',
      engine: result.engine,
      publishedDate: result.publishedDate,
    }));

  return {
    results,
    query: data.query,
    totalResults: data.number_of_results,
  };
}

/**
 * SearchConfigを使用してWeb検索を実行（discussion-engine用）
 */
export async function performSearch(
  query: string,
  config: SearchConfig
): Promise<SearchResult[]> {
  try {
    const { results } = await fetchSearchResults({
      query,
      searchType: config.searchType,
      maxResults: config.maxResults,
      language: config.language || 'ja',
      engines: config.engines,
    });
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
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
