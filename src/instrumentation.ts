/**
 * Next.js Instrumentation
 * サーバー起動時に1回だけ実行される
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('startup');

/**
 * 設定状況を確認してログ出力
 */
function logConfiguration() {
  // AIプロバイダーの設定状況
  const aiProviders = {
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GOOGLE_AI_API_KEY,
    ollama: process.env.OLLAMA_BASE_URL || 'localhost:11434',
  };

  // 検索プロバイダーの設定状況
  const searchProviders = {
    tavily: !!process.env.TAVILY_API_KEY,
    searxng: process.env.SEARXNG_BASE_URL || false,
    brave: !!process.env.BRAVE_SEARCH_API_KEY,
    serper: !!process.env.SERPER_API_KEY,
    duckduckgo: true, // 常に利用可能
  };

  // デフォルト検索プロバイダーを決定
  let defaultSearchProvider = 'duckduckgo';
  if (process.env.TAVILY_API_KEY) defaultSearchProvider = 'tavily';
  else if (process.env.SEARXNG_BASE_URL) defaultSearchProvider = 'searxng';
  else if (process.env.SERPER_API_KEY) defaultSearchProvider = 'serper';
  else if (process.env.BRAVE_SEARCH_API_KEY) defaultSearchProvider = 'brave';

  // その他の設定
  const otherConfig = {
    jina: !!process.env.JINA_API_KEY,
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  };

  // AI プロバイダー情報をフォーマット
  const aiStatus = Object.entries(aiProviders)
    .map(([name, value]) => {
      if (name === 'ollama') {
        return `${name}=${value}`;
      }
      return `${name}=${value ? 'configured' : '-'}`;
    })
    .join(', ');

  // 検索プロバイダー情報をフォーマット
  const searchStatus = Object.entries(searchProviders)
    .map(([name, value]) => {
      if (name === 'duckduckgo') {
        return `${name}=available`;
      }
      if (name === 'searxng' && value) {
        return `${name}=${value}`;
      }
      const isDefault = name === defaultSearchProvider;
      if (value) {
        return `${name}=configured${isDefault ? '(default)' : ''}`;
      }
      return `${name}=-`;
    })
    .join(', ');

  // ログ出力
  log.info('Application started', {
    env: process.env.NODE_ENV || 'development',
    aiProviders: aiStatus,
    searchProviders: searchStatus,
    defaultSearch: defaultSearchProvider,
    jina: otherConfig.jina ? 'configured' : '-',
    logLevel: otherConfig.logLevel,
  });
}

export async function register() {
  // サーバーサイドでのみ実行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.jsバージョンを出力（Edge Runtimeでは利用不可）
    const log = createLogger('startup');
    log.info('Node.js runtime', { version: process.version });
    logConfiguration();
  }
}
