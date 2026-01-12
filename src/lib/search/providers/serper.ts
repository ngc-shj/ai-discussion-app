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
} from '../types';

const SERPER_API_URL = 'https://google.serper.dev/search';
const SERPER_NEWS_API_URL = 'https://google.serper.dev/news';

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

    const isNews = searchType === 'news';
    const apiUrl = isNews ? SERPER_NEWS_API_URL : SERPER_API_URL;

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
      const error = await response.text();
      throw new Error(`Serper returned status ${response.status}: ${error}`);
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

    return {
      results: results.slice(0, maxResults),
      query,
      provider: this.name,
    };
  }
}
