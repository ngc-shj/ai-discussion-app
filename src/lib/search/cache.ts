/**
 * 検索結果および関連性判定のキャッシュ
 *
 * 1. 検索結果キャッシュ: 同じクエリの検索結果をキャッシュし、重複検索を避ける
 * 2. 関連性判定キャッシュ: 同じURL+トピックの判定結果をキャッシュし、AI呼び出しを削減
 */

import { SearchResult } from '@/types';
import { logger } from '@/lib/logger';

const log = logger.search.child({ component: 'cache' });

// ========================================
// 検索結果キャッシュ
// ========================================

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000; // 10分
const MAX_SEARCH_CACHE_SIZE = 50;

interface SearchCacheEntry {
  results: SearchResult[];
  timestamp: number;
}

// インメモリキャッシュ（検索結果用）
const searchCache = new Map<string, SearchCacheEntry>();

/**
 * 検索キャッシュのキーを生成
 */
function buildSearchCacheKey(query: string, provider?: string, maxResults?: number): string {
  return `${query}|${provider || 'default'}|${maxResults || 5}`;
}

/**
 * 検索結果をキャッシュから取得
 */
export function getSearchResultsFromCache(
  query: string,
  provider?: string,
  maxResults?: number
): SearchResult[] | null {
  const key = buildSearchCacheKey(query, provider, maxResults);
  const entry = searchCache.get(key);

  if (!entry) return null;

  // TTLチェック
  if (Date.now() - entry.timestamp > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    log.debug('Search cache expired', { query });
    return null;
  }

  log.debug('Search cache hit', { query, resultCount: entry.results.length });
  return entry.results;
}

/**
 * 検索結果をキャッシュに保存
 */
export function setSearchResultsToCache(
  query: string,
  results: SearchResult[],
  provider?: string,
  maxResults?: number
): void {
  const key = buildSearchCacheKey(query, provider, maxResults);

  // キャッシュサイズ制限
  if (searchCache.size >= MAX_SEARCH_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) {
      searchCache.delete(oldestKey);
      log.debug('Search cache evicted', { evictedKey: oldestKey });
    }
  }

  searchCache.set(key, {
    results,
    timestamp: Date.now(),
  });
  log.debug('Search cache set', { query, resultCount: results.length, cacheSize: searchCache.size });
}

// ========================================
// 関連性判定キャッシュ
// ========================================

const RELEVANCE_CACHE_TTL_MS = 30 * 60 * 1000; // 30分（関連性判定は変わりにくいので長め）
const MAX_RELEVANCE_CACHE_SIZE = 200;

export interface RelevanceCacheEntry {
  relevant: boolean;
  score: number;
  reason: string;
  extractedContent?: string;
  timestamp: number;
}

// インメモリキャッシュ（関連性判定用）
const relevanceCache = new Map<string, RelevanceCacheEntry>();

/**
 * 関連性判定キャッシュのキーを生成
 * URL + トピック（または検索キーワード）でキーを作成
 */
function buildRelevanceCacheKey(url: string, topic: string, searchKeywords?: string[]): string {
  // 検索キーワードがある場合はそれも含める（ラウンド検索では同じURLでもキーワードが異なる）
  const keywordsStr = searchKeywords?.join('|') || '';
  return `${url}|${topic}|${keywordsStr}`;
}

/**
 * 関連性判定結果をキャッシュから取得
 */
export function getRelevanceFromCache(
  url: string,
  topic: string,
  searchKeywords?: string[]
): Omit<RelevanceCacheEntry, 'timestamp'> | null {
  const key = buildRelevanceCacheKey(url, topic, searchKeywords);
  const entry = relevanceCache.get(key);

  if (!entry) return null;

  // TTLチェック
  if (Date.now() - entry.timestamp > RELEVANCE_CACHE_TTL_MS) {
    relevanceCache.delete(key);
    log.debug('Relevance cache expired', { url });
    return null;
  }

  log.debug('Relevance cache hit', { url, score: entry.score });
  return {
    relevant: entry.relevant,
    score: entry.score,
    reason: entry.reason,
    extractedContent: entry.extractedContent,
  };
}

/**
 * 関連性判定結果をキャッシュに保存
 */
export function setRelevanceToCache(
  url: string,
  topic: string,
  judgment: { relevant: boolean; score: number; reason: string; extractedContent?: string },
  searchKeywords?: string[]
): void {
  const key = buildRelevanceCacheKey(url, topic, searchKeywords);

  // キャッシュサイズ制限
  if (relevanceCache.size >= MAX_RELEVANCE_CACHE_SIZE) {
    const oldestKey = relevanceCache.keys().next().value;
    if (oldestKey) {
      relevanceCache.delete(oldestKey);
      log.debug('Relevance cache evicted', { evictedUrl: oldestKey.split('|')[0] });
    }
  }

  relevanceCache.set(key, {
    ...judgment,
    timestamp: Date.now(),
  });
  log.debug('Relevance cache set', { url, score: judgment.score, cacheSize: relevanceCache.size });
}

// ========================================
// キャッシュ管理
// ========================================

/**
 * 検索結果キャッシュをクリア
 */
export function clearSearchCache(): void {
  const size = searchCache.size;
  searchCache.clear();
  log.info('Search cache cleared', { previousSize: size });
}

/**
 * 関連性判定キャッシュをクリア
 */
export function clearRelevanceCache(): void {
  const size = relevanceCache.size;
  relevanceCache.clear();
  log.info('Relevance cache cleared', { previousSize: size });
}

/**
 * 全キャッシュをクリア
 */
export function clearAllSearchCaches(): void {
  clearSearchCache();
  clearRelevanceCache();
}

/**
 * キャッシュ統計を取得
 */
export function getCacheStats(): {
  searchCache: { size: number; maxSize: number; ttlMs: number };
  relevanceCache: { size: number; maxSize: number; ttlMs: number };
} {
  return {
    searchCache: {
      size: searchCache.size,
      maxSize: MAX_SEARCH_CACHE_SIZE,
      ttlMs: SEARCH_CACHE_TTL_MS,
    },
    relevanceCache: {
      size: relevanceCache.size,
      maxSize: MAX_RELEVANCE_CACHE_SIZE,
      ttlMs: RELEVANCE_CACHE_TTL_MS,
    },
  };
}
