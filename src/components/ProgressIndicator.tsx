'use client';

import { useState } from 'react';
import { AIProviderType, DiscussionParticipant, DEFAULT_PROVIDERS, getLocalModelColor, formatParticipantDisplayName } from '@/types';
import { ParticipantChip, SummaryChip, ProgressStatus, ProgressInfo, InterruptButton } from './progress-indicator';

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
  participants = [],
  completedParticipants = new Set(),
  onInterrupt,
}: ProgressIndicatorProps) {
  const [isInterrupting, setIsInterrupting] = useState(false);

  // isActiveがfalseになったら中断中状態をリセット
  if (!isActive && isInterrupting) {
    setIsInterrupting(false);
  }

  if (!isActive && !isSearching) return null;

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
          <SummaryChip isSummarizing={isSummarizing} />
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
          providerName={providerName}
          providerColor={providerColor}
          currentRound={currentRound}
          totalRounds={totalRounds}
          currentProviderIndex={currentProviderIndex}
          totalProviders={totalProviders}
        />
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <ProgressInfo
            isSearching={isSearching}
            isSummarizing={isSummarizing}
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
