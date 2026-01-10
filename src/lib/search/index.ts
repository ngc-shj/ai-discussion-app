import { SearchResult, SearchConfig } from '@/types';

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';

interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
  publishedDate?: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
  query: string;
  number_of_results: number;
}

/**
 * SearXNGを使用してWeb検索を実行
 */
export async function performSearch(
  query: string,
  config: SearchConfig
): Promise<SearchResult[]> {
  try {
    const url = new URL('/search', SEARXNG_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', config.language || 'ja');

    if (config.searchType === 'news') {
      url.searchParams.set('categories', 'news');
    } else if (config.searchType === 'images') {
      url.searchParams.set('categories', 'images');
    } else {
      url.searchParams.set('categories', 'general');
    }

    if (config.engines && config.engines.length > 0) {
      url.searchParams.set('engines', config.engines.join(','));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned status ${response.status}`);
    }

    const data: SearXNGResponse = await response.json();

    return data.results
      .slice(0, config.maxResults)
      .map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content || '',
        engine: result.engine,
        publishedDate: result.publishedDate,
      }));
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
