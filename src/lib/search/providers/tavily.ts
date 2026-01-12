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
} from '../types';

const TAVILY_API_URL = 'https://api.tavily.com/search';

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
      const error = await response.text();
      throw new Error(`Tavily returned status ${response.status}: ${error}`);
    }

    const data: TavilyResponse = await response.json();

    const results: SearchProviderResult[] = data.results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      publishedDate: result.published_date,
    }));

    return {
      results,
      query: data.query,
      provider: this.name,
    };
  }
}
