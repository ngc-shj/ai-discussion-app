'use client';

import { AIProviderType, DiscussionParticipant, DEFAULT_PROVIDERS, getOllamaModelColor } from '@/types';

interface ProgressIndicatorProps {
  isActive: boolean;
  currentRound: number;
  totalRounds: number;
  currentProvider: AIProviderType | null;
  currentParticipant: DiscussionParticipant | null;
  totalProviders: number;
  currentProviderIndex: number;
  isSummarizing: boolean;
  isSearching?: boolean;
}

export function ProgressIndicator({
  isActive,
  currentRound,
  totalRounds,
  currentProvider,
  currentParticipant,
  totalProviders,
  currentProviderIndex,
  isSummarizing,
  isSearching = false,
}: ProgressIndicatorProps) {
  if (!isActive && !isSearching) return null;

  const provider = DEFAULT_PROVIDERS.find((p) => p.id === currentProvider);
  const isOllama = currentProvider === 'ollama';
  const providerName = currentParticipant?.displayName || provider?.name || currentProvider;
  const providerColor = currentParticipant?.color || (isOllama && currentParticipant?.model ? getOllamaModelColor(currentParticipant.model) : provider?.color) || '#6B7280';

  // 全体の進捗計算
  const totalSteps = totalRounds * totalProviders + 1; // +1 for summary
  const currentStep = isSummarizing
    ? totalSteps
    : (currentRound - 1) * totalProviders + currentProviderIndex + 1;
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="px-3 py-2 md:px-4 md:py-3 bg-gray-800 border-t border-gray-700">
      {/* プログレスバー */}
      <div className="w-full h-1.5 md:h-2 bg-gray-700 rounded-full overflow-hidden mb-1.5 md:mb-2">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ステータス表示 */}
      <div className="flex items-center justify-between text-xs md:text-sm">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-1">
          {isSearching ? (
            <>
              <div className="animate-spin w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-cyan-400 border-t-transparent rounded-full shrink-0" />
              <span className="text-cyan-400 font-medium truncate">
                <svg className="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Web検索中...
              </span>
            </>
          ) : isSummarizing ? (
            <>
              <div className="animate-spin w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-purple-400 border-t-transparent rounded-full shrink-0" />
              <span className="text-purple-400 font-medium truncate">統合回答を生成中...</span>
            </>
          ) : (
            <>
              <div
                className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full animate-pulse shrink-0"
                style={{ backgroundColor: providerColor }}
              />
              <span className="text-gray-300 truncate">
                <span className="font-medium" style={{ color: providerColor }}>
                  {providerName}
                </span>
                <span className="hidden sm:inline">{' が回答中...'}</span>
                <span className="sm:hidden">...</span>
              </span>
            </>
          )}
        </div>
        <div className="text-gray-400 shrink-0 ml-2">
          {isSearching ? (
            <span className="hidden sm:inline">最新情報を取得中</span>
          ) : isSummarizing ? (
            <span className="hidden sm:inline">最終ステップ</span>
          ) : (
            <span>
              <span className="hidden sm:inline">ラウンド </span>{currentRound}/{totalRounds}
              <span className="hidden sm:inline"> ・ AI {currentProviderIndex + 1}/{totalProviders}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
