/**
 * Jina Reader API
 * https://r.jina.ai/{URL} でURLのコンテンツをMarkdownに変換して取得
 */

const JINA_READER_BASE_URL = 'https://r.jina.ai';

export interface JinaReaderOptions {
  apiKey?: string;  // APIキーがあると500 RPM、なしで20 RPM
  timeout?: number; // タイムアウト（ms）、デフォルト15秒
}

export interface JinaReaderResult {
  url: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Jina Readerを使用してURLのコンテンツをMarkdownで取得
 */
export async function fetchPageContent(
  url: string,
  options: JinaReaderOptions = {}
): Promise<JinaReaderResult> {
  const { apiKey, timeout = 15000 } = options;

  try {
    const jinaUrl = `${JINA_READER_BASE_URL}/${url}`;

    const headers: HeadersInit = {
      'Accept': 'text/plain',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        url,
        content: '',
        success: false,
        error: `Jina Reader returned status ${response.status}`,
      };
    }

    const content = await response.text();

    return {
      url,
      content,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      url,
      content: '',
      success: false,
      error: errorMessage.includes('abort') ? 'Request timeout' : errorMessage,
    };
  }
}

/**
 * 複数のURLのコンテンツを並列で取得
 * レート制限を考慮して、同時実行数を制限
 */
export async function fetchMultiplePageContents(
  urls: string[],
  options: JinaReaderOptions = {},
  concurrency: number = 3  // 同時実行数
): Promise<JinaReaderResult[]> {
  const results: JinaReaderResult[] = [];

  // バッチ処理で並列実行
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => fetchPageContent(url, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * 検索結果のURLから詳細コンテンツを取得
 */
export async function enrichSearchResultsWithContent(
  searchResults: { url: string; title: string; content: string }[],
  options: JinaReaderOptions = {},
  maxResults: number = 3  // 詳細取得する最大数
): Promise<{ url: string; title: string; content: string; fullContent?: string }[]> {
  const urlsToFetch = searchResults.slice(0, maxResults).map(r => r.url);

  const contents = await fetchMultiplePageContents(urlsToFetch, options);

  return searchResults.map(result => {
    const contentResult = contents.find(c => c.url === result.url);
    return {
      ...result,
      fullContent: contentResult?.success ? contentResult.content : undefined,
    };
  });
}
