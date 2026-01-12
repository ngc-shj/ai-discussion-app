/**
 * 検索警告ユーティリティ
 */

import { SearchWarning, SearchWarningType } from './types';

// 警告メッセージの定義
const WARNING_MESSAGES: Record<SearchWarningType, string> = {
  no_results: '検索結果が見つかりませんでした',
  rate_limited: 'リクエスト制限に達しました。しばらくお待ちください',
  timeout: '検索がタイムアウトしました',
  api_error: '検索APIでエラーが発生しました',
  low_relevance: 'トピックとの関連性が低い検索結果がフィルタされました',
};

/**
 * HTTPステータスコードから警告を生成
 */
export function createWarningFromHttpStatus(
  status: number,
  errorText?: string
): SearchWarning {
  if (status === 429) {
    return {
      type: 'rate_limited',
      message: WARNING_MESSAGES.rate_limited,
      code: status.toString(),
      retryable: true,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      type: 'api_error',
      message: `${WARNING_MESSAGES.api_error}: ${errorText || 'クライアントエラー'}`,
      code: status.toString(),
      retryable: status === 408, // Request Timeout
    };
  }

  if (status >= 500) {
    return {
      type: 'api_error',
      message: `${WARNING_MESSAGES.api_error}: ${errorText || 'サーバーエラー'}`,
      code: status.toString(),
      retryable: true,
    };
  }

  return {
    type: 'api_error',
    message: WARNING_MESSAGES.api_error,
    code: status.toString(),
    retryable: false,
  };
}

/**
 * エラーから警告を生成
 */
export function createWarningFromError(error: unknown): SearchWarning {
  if (error instanceof Error) {
    // タイムアウト検出
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('timed out') ||
      error.message.toLowerCase().includes('aborted')
    ) {
      return {
        type: 'timeout',
        message: WARNING_MESSAGES.timeout,
        retryable: true,
      };
    }

    // ネットワークエラー
    if (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      return {
        type: 'api_error',
        message: '検索サーバーへの接続に失敗しました',
        retryable: true,
      };
    }
  }

  // 汎用APIエラー
  return {
    type: 'api_error',
    message: WARNING_MESSAGES.api_error,
    retryable: false,
  };
}

/**
 * 結果0件の警告を生成
 */
export function createNoResultsWarning(): SearchWarning {
  return {
    type: 'no_results',
    message: WARNING_MESSAGES.no_results,
    retryable: true,
  };
}

/**
 * 低関連性フィルタリングの警告を生成
 */
export function createLowRelevanceWarning(filteredCount: number): SearchWarning {
  return {
    type: 'low_relevance',
    message: `${WARNING_MESSAGES.low_relevance}（${filteredCount}件除外）`,
    retryable: false,
  };
}
