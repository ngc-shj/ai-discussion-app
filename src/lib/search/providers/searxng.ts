/**
 * SearXNG検索プロバイダー
 */

import {
  ISearchProvider,
  SearchProviderParams,
  SearchProviderResponse,
  SearchProviderResult,
  SearchWarning,
} from '../types';
import {
  createWarningFromHttpStatus,
  createWarningFromError,
  createNoResultsWarning,
} from '../warning-utils';
import { logger } from '@/lib/logger';

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';
const DEFAULT_ENGINES = ['google'];
const log = logger.search.child({ provider: 'searxng' });

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
    const startTime = Date.now();

    log.info('Search started', { query, maxResults, language, searchType, engines: this.engines });

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

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const warning = createWarningFromHttpStatus(response.status);
        log.warn('HTTP error', { query, status: response.status, warning: warning.type });
        const error = new Error(`SearXNG returned status ${response.status}`);
        (error as Error & { warning: SearchWarning }).warning = warning;
        throw error;
      }

      const data: SearXNGResponse = await response.json();
      const duration = Date.now() - startTime;

      const results: SearchProviderResult[] = data.results
        .slice(0, maxResults)
        .map((result) => ({
          title: result.title,
          url: result.url,
          content: result.content || '',
          publishedDate: result.publishedDate,
        }));

      const warnings: SearchWarning[] = [];
      if (results.length === 0) {
        const warning = createNoResultsWarning();
        warnings.push(warning);
        log.warn('No search results', { query, duration });
      }

      log.info('Search completed', { query, resultCount: results.length, totalResults: data.number_of_results, duration });

      return {
        results,
        query: data.query,
        provider: this.name,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const warning = (error as Error & { warning?: SearchWarning }).warning || createWarningFromError(error);
      log.error('Search failed', error, { query, duration, warning: warning.type });
      const searchError = error instanceof Error ? error : new Error(String(error));
      (searchError as Error & { warning: SearchWarning }).warning = warning;
      throw searchError;
    }
  }
}
