'use client';

import { useState } from 'react';
import { AIProviderType, DiscussionParticipant, DEFAULT_PROVIDERS, getLocalModelColor, formatParticipantDisplayName } from '@/types';
import { useElapsedTime } from '@/hooks';
import { ParticipantChip, SummaryChip, ProgressStatus, ProgressInfo, InterruptButton } from './progress-indicator';

// 各参加者の実行状態
export type ParticipantStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ParticipantProgress {
  participant: DiscussionParticipant;
  status: ParticipantStatus;
  currentRound?: number;
}

// summaryStateの型定義
export type SummaryStateType = 'idle' | 'generating' | 'awaiting';

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
  isStreaming?: boolean;
  isSummaryStreaming?: boolean;
  isGeneratingFollowUps?: boolean;
  summaryState?: SummaryStateType;
  participants?: DiscussionParticipant[];
  completedParticipants?: Set<string>;
  onInterrupt?: () => void;
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
  isStreaming = false,
  isSummaryStreaming = false,
  isGeneratingFollowUps = false,
  summaryState = 'idle',
  participants = [],
  completedParticipants = new Set(),
  onInterrupt,
}: ProgressIndicatorProps) {
  const [isInterrupting, setIsInterrupting] = useState(false);

  // 参加者のキーを生成
  const getParticipantKey = (p: DiscussionParticipant) => `${p.provider}-${p.model}`;
  const currentParticipantKey = currentParticipant ? getParticipantKey(currentParticipant) : null;

  // 経過時間タイマー（応答待ち中のみカウント、ストリーミング中はカウントしない）
  const isWaitingForResponse = isActive && !isStreaming && !isSummarizing && !isSearching;
  const { formattedTime } = useElapsedTime(
    isWaitingForResponse,
    // 参加者が切り替わったらタイマーをリセット（同じモデルでも別参加者なら別キー）
    `${currentRound}-${currentProviderIndex}`
  );

  // isActiveがfalseになったら中断中状態をリセット
  if (!isActive && isInterrupting) {
    setIsInterrupting(false);
  }

  // 表示条件: 議論中、検索中、統合回答生成中/ストリーミング中、フォローアップ生成中
  // 注: 投票待ち（awaiting）では非表示にする（アクションボタンはDiscussionPanel内に表示）
  const shouldShow = isActive || isSearching || isSummarizing || isSummaryStreaming || isGeneratingFollowUps;
  if (!shouldShow) return null;

  const handleInterrupt = () => {
    if (onInterrupt && !isInterrupting) {
      setIsInterrupting(true);
      onInterrupt();
    }
  };

  const provider = DEFAULT_PROVIDERS.find((p) => p.id === currentProvider);
  const providerName = currentParticipant
    ? formatParticipantDisplayName(currentParticipant)
    : (provider?.name || currentProvider || '');
  const providerColor = currentParticipant?.color || (provider?.isLocal && currentParticipant?.model ? getLocalModelColor(currentParticipant.model) : provider?.color) || '#6B7280';

  // 全体の進捗計算（議論 + 統合回答 + フォローアップ生成）
  const totalSteps = totalRounds * totalProviders + 2; // +1 for summary, +1 for follow-ups
  let currentStep: number;
  if (isGeneratingFollowUps) {
    // フォローアップ生成中 = 最終ステップ
    currentStep = totalSteps;
  } else if (isSummarizing || isSummaryStreaming) {
    // 統合回答生成中
    currentStep = totalSteps - 1;
  } else {
    // 議論中
    currentStep = (currentRound - 1) * totalProviders + currentProviderIndex + 1;
  }
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="px-3 py-2 md:px-4 md:py-3 bg-gray-800 border-t border-gray-700">
      {/* 参加モデル一覧 */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {participants.map((p, index) => {
            const key = getParticipantKey(p);
            const isCurrentActive = key === currentParticipantKey && !isSummarizing && !isSearching;
            const isCompleted = completedParticipants.has(key);

            return (
              <ParticipantChip
                key={`${key}-${index}`}
                participant={p}
                index={index}
                isActive={isCurrentActive}
                isCompleted={isCompleted}
              />
            );
          })}
          <SummaryChip
            isSummarizing={isSummarizing}
            isSummaryStreaming={isSummaryStreaming}
            isCompleted={isGeneratingFollowUps}
          />
          {/* フォローアップ生成中のみ表示 */}
          {isGeneratingFollowUps && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border border-green-400 bg-green-400/20 ring-2 ring-green-400 ring-offset-1 ring-offset-gray-800 scale-105 transition-all duration-300"
              title="フォローアップ質問を生成中"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 font-medium">F/U</span>
            </div>
          )}
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
        <ProgressStatus
          isSearching={isSearching}
          isSummarizing={isSummarizing}
          isSummaryStreaming={isSummaryStreaming}
          isGeneratingFollowUps={isGeneratingFollowUps}
          providerName={providerName}
          providerColor={providerColor}
          currentRound={currentRound}
          totalRounds={totalRounds}
          currentProviderIndex={currentProviderIndex}
          totalProviders={totalProviders}
          elapsedTime={isWaitingForResponse ? formattedTime : undefined}
        />
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <ProgressInfo
            isSearching={isSearching}
            isSummarizing={isSummarizing}
            isSummaryStreaming={isSummaryStreaming}
            isGeneratingFollowUps={isGeneratingFollowUps}
            currentRound={currentRound}
            totalRounds={totalRounds}
            currentProviderIndex={currentProviderIndex}
            totalProviders={totalProviders}
          />
          {/* 中断ボタン */}
          {onInterrupt && !isSummarizing && !isSearching && (
            <InterruptButton
              isInterrupting={isInterrupting}
              onInterrupt={handleInterrupt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
