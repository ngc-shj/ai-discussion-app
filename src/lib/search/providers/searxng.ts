/**
 * SearXNG検索プロバイダー
 */

import {
  ISearchProvider,
  SearchProviderParams,
  SearchProviderResponse,
  SearchProviderResult,
} from '../types';

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';
const DEFAULT_ENGINES = ['google'];

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

export class SearXNGProvider implements ISearchProvider {
  readonly name = 'searxng' as const;
  readonly displayName = 'SearXNG';
  readonly requiresApiKey = false;

  private engines: string[];

  constructor(engines?: string[]) {
    this.engines = engines && engines.length > 0 ? engines : DEFAULT_ENGINES;
  }

  isAvailable(): boolean {
    return !!process.env.SEARXNG_BASE_URL;
  }

  async search(params: SearchProviderParams): Promise<SearchProviderResponse> {
    const { query, maxResults = 5, language = 'ja', searchType = 'web' } = params;

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

    url.searchParams.set('engines', this.engines.join(','));

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned status ${response.status}`);
    }

    const data: SearXNGResponse = await response.json();

    const results: SearchProviderResult[] = data.results
      .slice(0, maxResults)
      .map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content || '',
        publishedDate: result.publishedDate,
      }));

    return {
      results,
      query: data.query,
      provider: this.name,
    };
  }
}
