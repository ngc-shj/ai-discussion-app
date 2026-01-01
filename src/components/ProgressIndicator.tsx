'use client';

import { AIProviderType, DiscussionParticipant, DEFAULT_PROVIDERS, getOllamaModelColor, ROLE_PRESETS } from '@/types';

// 各参加者の実行状態
export type ParticipantStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ParticipantProgress {
  participant: DiscussionParticipant;
  status: ParticipantStatus;
  currentRound?: number;
}

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
  participants?: DiscussionParticipant[];
  completedParticipants?: Set<string>;
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
  participants = [],
  completedParticipants = new Set(),
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

  // 参加者のキーを生成
  const getParticipantKey = (p: DiscussionParticipant) => `${p.provider}-${p.model}`;
  const currentParticipantKey = currentParticipant ? getParticipantKey(currentParticipant) : null;

  return (
    <div className="px-3 py-2 md:px-4 md:py-3 bg-gray-800 border-t border-gray-700">
      {/* 参加モデル一覧 */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {participants.map((p, index) => {
            const key = getParticipantKey(p);
            const isCurrentActive = key === currentParticipantKey && !isSummarizing && !isSearching;
            const isCompleted = completedParticipants.has(key);
            const isPending = !isCurrentActive && !isCompleted;

            // モデル名を短縮表示
            const shortName = p.model.includes('/')
              ? p.model.split('/').pop()
              : p.model.length > 15
                ? p.model.slice(0, 12) + '...'
                : p.model;

            // ロール名を取得（中立以外の場合のみ表示）
            const rolePreset = p.role && p.role !== 'neutral'
              ? ROLE_PRESETS.find((r) => r.id === p.role)
              : undefined;

            return (
              <div
                key={`${key}-${index}`}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
                  transition-all duration-300
                  ${isCurrentActive
                    ? 'ring-2 ring-offset-1 ring-offset-gray-800 scale-105'
                    : isCompleted
                      ? 'opacity-60'
                      : 'opacity-40'
                  }
                `}
                style={{
                  backgroundColor: `${p.color}20`,
                  borderColor: p.color,
                  borderWidth: '1px',
                  // @ts-expect-error CSS custom property for ring color
                  '--tw-ring-color': isCurrentActive ? p.color : undefined,
                }}
                title={`${p.displayName}${rolePreset ? ` [${rolePreset.name}]` : ''}${isCurrentActive ? ' (実行中)' : isCompleted ? ' (完了)' : ' (待機中)'}`}
              >
                {/* ステータスインジケーター */}
                <div className="relative">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${isCurrentActive ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: p.color }}
                  />
                  {isCompleted && (
                    <svg
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {/* モデル名 */}
                <span
                  className={`font-medium ${isPending ? 'text-gray-500' : ''}`}
                  style={{ color: isPending ? undefined : p.color }}
                >
                  {shortName}
                </span>
                {/* ロール表示（中立以外） */}
                {rolePreset && (
                  <span className="text-gray-400 text-[10px]">
                    [{rolePreset.name}]
                  </span>
                )}
              </div>
            );
          })}
          {/* 統合回答のインジケーター */}
          <div
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border
              transition-all duration-300
              ${isSummarizing
                ? 'border-purple-400 bg-purple-400/20 ring-2 ring-purple-400 ring-offset-1 ring-offset-gray-800 scale-105'
                : 'border-gray-600 bg-gray-700/50 opacity-40'
              }
            `}
            title={isSummarizing ? '統合回答を生成中' : '統合回答 (待機中)'}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${isSummarizing ? 'bg-purple-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className={isSummarizing ? 'text-purple-400 font-medium' : 'text-gray-500'}>統合</span>
          </div>
        </div>
      )}

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
