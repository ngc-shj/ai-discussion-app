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
} from '../types';

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';
const BRAVE_NEWS_API_URL = 'https://api.search.brave.com/res/v1/news/search';

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

    const isNews = searchType === 'news';
    const baseUrl = isNews ? BRAVE_NEWS_API_URL : BRAVE_API_URL;

    const url = new URL(baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('count', maxResults.toString());
    if (language) {
      url.searchParams.set('search_lang', language);
      url.searchParams.set('ui_lang', language);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Brave Search returned status ${response.status}: ${error}`);
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

    return {
      results: results.slice(0, maxResults),
      query,
      provider: this.name,
    };
  }
}
