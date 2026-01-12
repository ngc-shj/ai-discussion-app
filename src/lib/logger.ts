/**
 * アプリケーションロガー
 * pinoを使用した構造化ログ
 */

import pino from 'pino';

// ログレベルの定義
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 環境に応じたログレベル
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// ベースロガーの作成
const baseLogger = pino({
  level: LOG_LEVEL,
  // 開発環境では読みやすい形式、本番ではJSON
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  }),
  // タイムスタンプ形式
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * モジュール別ロガーを作成
 */
export function createLogger(module: string) {
  const child = baseLogger.child({ module });

  return {
    /**
     * デバッグ情報（開発時のみ）
     */
    debug: (message: string, data?: Record<string, unknown>) => {
      child.debug(data || {}, message);
    },

    /**
     * 一般的な情報
     */
    info: (message: string, data?: Record<string, unknown>) => {
      child.info(data || {}, message);
    },

    /**
     * 警告（処理は継続するが注意が必要）
     */
    warn: (message: string, data?: Record<string, unknown>) => {
      child.warn(data || {}, message);
    },

    /**
     * エラー（処理の失敗）
     */
    error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
      const errorData: Record<string, unknown> = { ...data };

      if (error instanceof Error) {
        errorData.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else if (error !== undefined) {
        errorData.error = error;
      }

      child.error(errorData, message);
    },

    /**
     * 子ロガーを作成（追加コンテキスト付き）
     */
    child: (bindings: Record<string, unknown>) => {
      const childLogger = child.child(bindings);
      return {
        debug: (message: string, data?: Record<string, unknown>) => {
          childLogger.debug(data || {}, message);
        },
        info: (message: string, data?: Record<string, unknown>) => {
          childLogger.info(data || {}, message);
        },
        warn: (message: string, data?: Record<string, unknown>) => {
          childLogger.warn(data || {}, message);
        },
        error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
          const errorData: Record<string, unknown> = { ...data };
          if (error instanceof Error) {
            errorData.error = {
              name: error.name,
              message: error.message,
              stack: error.stack,
            };
          } else if (error !== undefined) {
            errorData.error = error;
          }
          childLogger.error(errorData, message);
        },
      };
    },
  };
}

// プリセットロガー（よく使うモジュール用）
export const logger = {
  search: createLogger('search'),
  api: createLogger('api'),
  ai: createLogger('ai'),
  discussion: createLogger('discussion'),
  storage: createLogger('storage'),
};

export default logger;
