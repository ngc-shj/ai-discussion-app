/**
 * Jina Reader API
 * https://r.jina.ai/{URL} でURLのコンテンツをMarkdownに変換して取得
 */

import { logger } from '@/lib/logger';
import { SearchWarning } from './types';
import { createWarningFromHttpStatus } from './warning-utils';

const log = logger.search.child({ component: 'jina-reader' });
const JINA_READER_BASE_URL = 'https://r.jina.ai';

// キャッシュの設定
const CACHE_TTL_MS = 30 * 60 * 1000; // 30分
const MAX_CACHE_SIZE = 100; // 最大キャッシュ数

// リトライの設定
const DEFAULT_MAX_RETRIES = 2; // 最大リトライ回数（計3回試行）
const RETRY_DELAY_MS = 1000; // リトライ間隔

interface CacheEntry {
  content: string;
  timestamp: number;
}

// インメモリキャッシュ
const contentCache = new Map<string, CacheEntry>();

// 進行中のリクエストを追跡（同じURLへの重複リクエストを防止）
const inFlightRequests = new Map<string, Promise<JinaReaderResult>>();

/**
 * キャッシュからコンテンツを取得
 */
function getFromCache(url: string): string | null {
  const entry = contentCache.get(url);
  if (!entry) return null;

  // TTLチェック
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    contentCache.delete(url);
    log.debug('Cache expired', { url });
    return null;
  }

  log.debug('Cache hit', { url });
  return entry.content;
}

/**
 * キャッシュにコンテンツを保存
 */
function setToCache(url: string, content: string): void {
  // キャッシュサイズ制限を超えた場合、古いエントリを削除
  if (contentCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = contentCache.keys().next().value;
    if (oldestKey) {
      contentCache.delete(oldestKey);
      log.debug('Cache evicted oldest entry', { url: oldestKey });
    }
  }

  contentCache.set(url, {
    content,
    timestamp: Date.now(),
  });
  log.debug('Cache set', { url, cacheSize: contentCache.size });
}

/**
 * キャッシュをクリア
 */
export function clearContentCache(): void {
  const size = contentCache.size;
  contentCache.clear();
  log.info('Cache cleared', { previousSize: size });
}

export interface JinaReaderOptions {
  apiKey?: string;  // APIキーがあると500 RPM、なしで20 RPM
  timeout?: number; // タイムアウト（ms）、デフォルト15秒
  maxRetries?: number; // 最大リトライ回数、デフォルト2
}

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface JinaReaderResult {
  url: string;
  content: string;
  success: boolean;
  error?: string;
  warning?: SearchWarning;
}

/**
 * AbortErrorから警告を生成（クライアント側タイムアウト）
 */
function createAbortWarning(): SearchWarning {
  return {
    type: 'timeout',
    message: 'リクエストがタイムアウトしました（クライアント側で中断）',
    retryable: true,
  };
}

/**
 * 一般的なエラーから警告を生成
 */
function createJinaErrorWarning(errorMessage: string): SearchWarning {
  return {
    type: 'api_error',
    message: `Jina Reader エラー: ${errorMessage}`,
    retryable: true,
  };
}

/**
 * 単一のfetch試行を実行
 */
async function attemptFetch(
  jinaUrl: string,
  headers: HeadersInit,
  timeout: number
): Promise<{ success: true; content: string } | { success: false; error: string; retryable: boolean; status?: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 4xx エラーはリトライしない、5xx はリトライ可能
      const retryable = response.status >= 500;
      return {
        success: false,
        error: `Jina Reader returned status ${response.status}`,
        retryable,
        status: response.status,
      };
    }

    const content = await response.text();
    return { success: true, content };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAborted = errorMessage.includes('abort');
    return {
      success: false,
      error: isAborted ? 'Request timeout' : errorMessage,
      retryable: true, // タイムアウトやネットワークエラーはリトライ可能
    };
  }
}

/**
 * Jina Readerを使用してURLのコンテンツをMarkdownで取得
 */
export async function fetchPageContent(
  url: string,
  options: JinaReaderOptions = {}
): Promise<JinaReaderResult> {
  const { apiKey, timeout = 15000, maxRetries = DEFAULT_MAX_RETRIES } = options;
  const startTime = Date.now();

  // キャッシュをチェック
  const cachedContent = getFromCache(url);
  if (cachedContent) {
    log.info('Cache hit (jina)', { url, contentLength: cachedContent.length });
    return {
      url,
      content: cachedContent,
      success: true,
    };
  }

  // 同じURLへの進行中リクエストがあれば、その結果を待つ
  const inFlightRequest = inFlightRequests.get(url);
  if (inFlightRequest) {
    log.info('Waiting for in-flight request', { url });
    return inFlightRequest;
  }

  // 実際のフェッチを実行する内部関数
  const doFetch = async (): Promise<JinaReaderResult> => {
    const jinaUrl = `${JINA_READER_BASE_URL}/${url}`;
    const headers: HeadersInit = {
      'Accept': 'text/plain',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let lastError: { error: string; status?: number } | null = null;

    // リトライループ
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        log.debug('Retrying fetch', { url, attempt, maxRetries });
        await sleep(RETRY_DELAY_MS);
      }

      log.debug('Fetching page content', { url, timeout, attempt });

      const result = await attemptFetch(jinaUrl, headers, timeout);

      if (result.success) {
        const duration = Date.now() - startTime;
        setToCache(url, result.content);
        log.info('Fetch completed', { url, contentLength: result.content.length, duration, attempts: attempt + 1 });
        return {
          url,
          content: result.content,
          success: true,
        };
      }

      lastError = { error: result.error, status: result.status };

      // リトライ不可能なエラーの場合は即座に終了
      if (!result.retryable) {
        log.warn('Fetch failed (not retryable)', { url, error: result.error, status: result.status, attempt });
        break;
      }

      log.debug('Fetch attempt failed', { url, error: result.error, attempt, willRetry: attempt < maxRetries });
    }

    // 全リトライ失敗
    const duration = Date.now() - startTime;
    const isTimeout = lastError?.error === 'Request timeout';
    const warning = lastError?.status
      ? createWarningFromHttpStatus(lastError.status)
      : isTimeout
        ? createAbortWarning()
        : createJinaErrorWarning(lastError?.error || 'Unknown error');

    log.warn('Fetch failed after retries', { url, duration, attempts: maxRetries + 1, warning: warning.type, error: lastError?.error });

    return {
      url,
      content: '',
      success: false,
      error: lastError?.error || 'Unknown error',
      warning,
    };
  };

  // リクエストを登録して実行
  const fetchPromise = doFetch().finally(() => {
    // 完了後にin-flightリストから削除
    inFlightRequests.delete(url);
  });
  inFlightRequests.set(url, fetchPromise);

  return fetchPromise;
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
