/**
 * Brave Search検索プロバイダー
 * https://brave.com/search/api/
 * 独自インデックスを持つプライバシー重視の検索
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

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';
const BRAVE_NEWS_API_URL = 'https://api.search.brave.com/res/v1/news/search';
const log = logger.search.child({ provider: 'brave' });

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
}

interface BraveNewsResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveWebResponse {
  query: {
    original: string;
  };
  web?: {
    results: BraveWebResult[];
  };
}

interface BraveNewsResponse {
  query: {
    original: string;
  };
  results?: BraveNewsResult[];
}

export class BraveSearchProvider implements ISearchProvider {
  readonly name = 'brave' as const;
  readonly displayName = 'Brave Search';
  readonly requiresApiKey = true;

  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(params: SearchProviderParams): Promise<SearchProviderResponse> {
    if (!this.apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY is not configured');
    }

    const { query, maxResults = 5, language = 'ja', searchType = 'web' } = params;
    const startTime = Date.now();
    const isNews = searchType === 'news';

    log.info('Search started', { query, maxResults, language, searchType });

    const baseUrl = isNews ? BRAVE_NEWS_API_URL : BRAVE_API_URL;

    const url = new URL(baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('count', maxResults.toString());
    if (language) {
      url.searchParams.set('search_lang', language);
      url.searchParams.set('ui_lang', language);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const warning = createWarningFromHttpStatus(response.status, errorText);
        log.warn('HTTP error', { query, status: response.status, errorText, warning: warning.type });
        const error = new Error(`Brave Search returned status ${response.status}: ${errorText}`);
        (error as Error & { warning: SearchWarning }).warning = warning;
        throw error;
      }

      let results: SearchProviderResult[];

      if (isNews) {
        const data: BraveNewsResponse = await response.json();
        results = (data.results || []).map((result) => ({
          title: result.title,
          url: result.url,
          content: result.description,
          publishedDate: result.age,
        }));
      } else {
        const data: BraveWebResponse = await response.json();
        results = (data.web?.results || []).map((result) => ({
          title: result.title,
          url: result.url,
          content: result.description,
          publishedDate: result.age || result.page_age,
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
