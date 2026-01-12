/**
 * DuckDuckGo検索プロバイダー
 * APIキー不要で使用可能
 * DuckDuckGo Instant Answer APIを使用
 */

import {
  ISearchProvider,
  SearchProviderParams,
  SearchProviderResponse,
  SearchProviderResult,
} from '../types';

const DDG_API_URL = 'https://api.duckduckgo.com/';
const DDG_HTML_URL = 'https://html.duckduckgo.com/html/';

interface DDGRelatedTopic {
  Text?: string;
  FirstURL?: string;
  Result?: string;
}

interface DDGResponse {
  Abstract?: string;
  AbstractURL?: string;
  AbstractText?: string;
  Heading?: string;
  RelatedTopics?: DDGRelatedTopic[];
  Results?: DDGRelatedTopic[];
}

export class DuckDuckGoProvider implements ISearchProvider {
  readonly name = 'duckduckgo' as const;
  readonly displayName = 'DuckDuckGo';
  readonly requiresApiKey = false;

  isAvailable(): boolean {
    return true; // 常に利用可能
  }

  async search(params: SearchProviderParams): Promise<SearchProviderResponse> {
    const { query, maxResults = 5 } = params;

    // DuckDuckGo Instant Answer APIを試す
    const url = new URL(DDG_API_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('skip_disambig', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const data: DDGResponse = await response.json();

    const results: SearchProviderResult[] = [];

    // Abstract（メインの回答）があれば追加
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        content: data.AbstractText || data.Abstract,
      });
    }

    // RelatedTopicsから結果を追加
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= maxResults) break;
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: this.extractTitle(topic.Text),
            url: topic.FirstURL,
            content: topic.Text,
          });
        }
      }
    }

    // Resultsから結果を追加
    if (data.Results) {
      for (const result of data.Results) {
        if (results.length >= maxResults) break;
        if (result.Text && result.FirstURL) {
          results.push({
            title: this.extractTitle(result.Text),
            url: result.FirstURL,
            content: result.Text,
          });
        }
      }
    }

    return {
      results: results.slice(0, maxResults),
      query,
      provider: this.name,
    };
  }

  private extractTitle(text: string): string {
    // テキストの最初の部分をタイトルとして抽出
    const dash = text.indexOf(' - ');
    if (dash > 0 && dash < 100) {
      return text.substring(0, dash);
    }
    return text.substring(0, Math.min(text.length, 60));
  }
}
