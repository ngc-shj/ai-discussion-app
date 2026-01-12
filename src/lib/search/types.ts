/**
 * 検索プロバイダーの共通型定義
 */

import { SearchProviderType } from '@/types';

// 後方互換性のためのエイリアス
export type SearchProvider = SearchProviderType;

// 検索結果の共通インターフェース
export interface SearchProviderResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

// 検索パラメータの共通インターフェース
export interface SearchProviderParams {
  query: string;
  maxResults?: number;
  language?: string;
  searchType?: 'web' | 'news' | 'images';
}

// 警告の種類
export type SearchWarningType =
  | 'no_results'    // 検索結果が0件
  | 'rate_limited'  // レートリミット (HTTP 429)
  | 'timeout'       // タイムアウト
  | 'api_error'     // その他のAPIエラー
  | 'low_relevance'; // 関連性が低い結果がフィルタされた

// 警告の詳細情報
export interface SearchWarning {
  type: SearchWarningType;
  message: string;
  code?: string;
  retryable: boolean;
}

// 検索レスポンスの共通インターフェース
export interface SearchProviderResponse {
  results: SearchProviderResult[];
  query: string;
  provider: SearchProvider;
  warnings?: SearchWarning[];
}

// 検索プロバイダーのインターフェース
export interface ISearchProvider {
  readonly name: SearchProvider;
  readonly displayName: string;
  readonly requiresApiKey: boolean;

  /**
   * このプロバイダーが利用可能かどうかを確認
   */
  isAvailable(): boolean;

  /**
   * 検索を実行
   */
  search(params: SearchProviderParams): Promise<SearchProviderResponse>;
}

// 検索プロバイダーのメタデータ
export interface SearchProviderInfo {
  id: SearchProvider;
  name: string;
  description: string;
  requiresApiKey: boolean;
  available: boolean;
}

// 検索プロバイダーの設定
export interface SearchProviderConfig {
  provider: SearchProvider;
  // SearXNG用のオプション（内部エンジン選択）
  engines?: string[];
}
