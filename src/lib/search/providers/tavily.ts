/**
 * Tavily検索プロバイダー
 * https://tavily.com/
 * AI向けに最適化された検索API
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

const TAVILY_API_URL = 'https://api.tavily.com/search';
const log = logger.search.child({ provider: 'tavily' });

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  query: string;
  results: TavilyResult[];
  response_time: number;
}

export class TavilyProvider implements ISearchProvider {
  readonly name = 'tavily' as const;
  readonly displayName = 'Tavily';
  readonly requiresApiKey = true;

  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(params: SearchProviderParams): Promise<SearchProviderResponse> {
    if (!this.apiKey) {
      throw new Error('TAVILY_API_KEY is not configured');
    }

    const { query, maxResults = 5, searchType = 'web' } = params;
    const startTime = Date.now();

    log.info('Search started', { query, maxResults, searchType });

    try {
      const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: maxResults,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
          topic: searchType === 'news' ? 'news' : 'general',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const warning = createWarningFromHttpStatus(response.status, errorText);
        log.warn('HTTP error', { query, status: response.status, errorText, warning: warning.type });
        const error = new Error(`Tavily returned status ${response.status}: ${errorText}`);
        (error as Error & { warning: SearchWarning }).warning = warning;
        throw error;
      }

      const data: TavilyResponse = await response.json();
      const duration = Date.now() - startTime;

      const results: SearchProviderResult[] = data.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        publishedDate: result.published_date,
      }));

      const warnings: SearchWarning[] = [];
      if (results.length === 0) {
        const warning = createNoResultsWarning();
        warnings.push(warning);
        log.warn('No search results', { query, duration });
      }

      log.info('Search completed', { query, resultCount: results.length, duration, responseTime: data.response_time });

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
