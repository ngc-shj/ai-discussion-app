/**
 * DuckDuckGo検索プロバイダー
 * APIキー不要で使用可能
 * DuckDuckGo HTML版をスクレイピング
 */

import {
  ISearchProvider,
  SearchProviderParams,
  SearchProviderResponse,
  SearchProviderResult,
} from '../types';

const DDG_HTML_URL = 'https://html.duckduckgo.com/html/';

export class DuckDuckGoProvider implements ISearchProvider {
  readonly name = 'duckduckgo' as const;
  readonly displayName = 'DuckDuckGo';
  readonly requiresApiKey = false;

  isAvailable(): boolean {
    return true;
  }

  async search(params: SearchProviderParams): Promise<SearchProviderResponse> {
    const { query, maxResults = 5 } = params;

    const formData = new URLSearchParams();
    formData.append('q', query);

    const response = await fetch(DDG_HTML_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; AIDiscussionApp/1.0)',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const html = await response.text();
    const results = this.parseResults(html, maxResults);

    return {
      results,
      query,
      provider: this.name,
    };
  }

  private parseResults(html: string, maxResults: number): SearchProviderResult[] {
    const results: SearchProviderResult[] = [];

    // 各検索結果ブロックを抽出
    const resultBlocks = html.split('class="result ');

    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i];

      // URLを抽出 (href="//duckduckgo.com/l/?uddg=..." 形式)
      const urlMatch = block.match(/class="result__a"[^>]+href="([^"]+)"/);
      if (!urlMatch) continue;

      const url = this.decodeRedirectUrl(urlMatch[1]);
      if (!url || !url.startsWith('http')) continue;

      // タイトルを抽出
      const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)<\/a>/);
      const title = titleMatch ? this.decodeHtmlEntities(titleMatch[1].trim()) : '';
      if (!title) continue;

      // スニペットを抽出
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      let content = '';
      if (snippetMatch) {
        content = this.decodeHtmlEntities(this.stripHtml(snippetMatch[1])).trim();
      }

      // 重複チェック
      if (results.some(r => r.url === url)) continue;

      results.push({ title, url, content });
    }

    return results;
  }

  private decodeRedirectUrl(url: string): string {
    if (url.includes('uddg=')) {
      const match = url.match(/uddg=([^&]+)/);
      if (match) {
        try {
          return decodeURIComponent(match[1]);
        } catch {
          return url;
        }
      }
    }
    return url;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
