/**
 * Serper検索プロバイダー
 * https://serper.dev/
 * Google検索結果をAPI経由で取得
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

const SERPER_API_URL = 'https://google.serper.dev/search';
const SERPER_NEWS_API_URL = 'https://google.serper.dev/news';
const log = logger.search.child({ provider: 'serper' });

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

interface SerperWebResponse {
  searchParameters: {
    q: string;
  };
  organic?: SerperOrganicResult[];
}

interface SerperNewsResponse {
  searchParameters: {
    q: string;
  };
  news?: SerperNewsResult[];
}

export class SerperProvider implements ISearchProvider {
  readonly name = 'serper' as const;
  readonly displayName = 'Serper (Google)';
  readonly requiresApiKey = true;

  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.SERPER_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(params: SearchProviderParams): Promise<SearchProviderResponse> {
    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY is not configured');
    }

    const { query, maxResults = 5, language = 'ja', searchType = 'web' } = params;
    const startTime = Date.now();
    const isNews = searchType === 'news';

    log.info('Search started', { query, maxResults, language, searchType });

    const apiUrl = isNews ? SERPER_NEWS_API_URL : SERPER_API_URL;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          q: query,
          num: maxResults,
          hl: language,
          gl: language === 'ja' ? 'jp' : language === 'en' ? 'us' : undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const warning = createWarningFromHttpStatus(response.status, errorText);
        log.warn('HTTP error', { query, status: response.status, errorText, warning: warning.type });
        const error = new Error(`Serper returned status ${response.status}: ${errorText}`);
        (error as Error & { warning: SearchWarning }).warning = warning;
        throw error;
      }

      let results: SearchProviderResult[];

      if (isNews) {
        const data: SerperNewsResponse = await response.json();
        results = (data.news || []).map((result) => ({
          title: result.title,
          url: result.link,
          content: result.snippet,
          publishedDate: result.date,
        }));
      } else {
        const data: SerperWebResponse = await response.json();
        results = (data.organic || []).map((result) => ({
          title: result.title,
          url: result.link,
          content: result.snippet,
          publishedDate: result.date,
        }));
      }

      const duration = Date.now() - startTime;
      const warnings: SearchWarning[] = [];
      if (results.length === 0) {
        const warning = createNoResultsWarning();
        warnings.push(warning);
        log.warn('No search results', { query, duration });
      }

      log.info('Search completed', { query, resultCount: results.length, duration });

      return {
        results: results.slice(0, maxResults),
        query,
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
