'use client';

import { useEffect, useRef } from 'react';
import { DiscussionTurn, DiscussionMessage, DiscussionParticipant, SearchResult, SearchKeywordInfo, SearchUiProgress, MessageVote, FollowUpQuestion, DeepDiveType, SummaryPhase, ExtendDiscussionConfig, DiscussionMode, DiscussionDepth, StartMarker, ExtensionMarker } from '@/types';
import { StreamingMessage } from '@/hooks';
import { TurnDisplay } from './TurnDisplay';
import { CurrentTurnDisplay } from './CurrentTurnDisplay';

interface DiscussionPanelProps {
  turns: DiscussionTurn[];
  currentMessages: DiscussionMessage[];
  participants?: DiscussionParticipant[]; // 実行中の参加者リスト
  currentTopic?: string;
  currentFinalAnswer?: string;
  currentSummaryPrompt?: string;
  isDiscussing: boolean;
  isInterrupting?: boolean;
  searchResults?: SearchResult[];
  searchKeywords?: SearchKeywordInfo[];
  searchProgress?: SearchUiProgress | null; // 検索進捗状態
  onFollowUp?: (topic: string, previousAnswer: string) => void;
  onDeepDive?: (topic: string, previousAnswer: string, type: DeepDiveType, customPrompt?: string) => void;
  onCounterargument?: (topic: string, previousAnswer: string) => void;
  onFork?: (turnId: string, topic: string, previousAnswer: string, label: string, perspective: string) => void;
  onGenerateFollowUps?: (turnId: string, topic: string, finalAnswer: string) => void;
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  suggestedFollowUps?: FollowUpQuestion[];
  isGeneratingFollowUps?: boolean;
  summaryPhase?: SummaryPhase;
  onFinalizeDiscussion?: () => void;
  onExtendDiscussion?: (config: ExtendDiscussionConfig) => void;
  currentRounds?: number;
  currentMode?: DiscussionMode;
  currentDepth?: DiscussionDepth;
  currentKeywords?: string[];
  streamingMessage?: StreamingMessage | null;
  startMarker?: StartMarker | null;
  extensionMarkers?: ExtensionMarker[];
}

export function DiscussionPanel({
  turns,
  currentMessages,
  participants,
  currentTopic,
  currentFinalAnswer,
  currentSummaryPrompt,
  isDiscussing,
  isInterrupting,
  searchResults,
  searchKeywords,
  searchProgress,
  onFollowUp,
  onDeepDive,
  onCounterargument,
  onFork,
  onGenerateFollowUps,
  messageVotes,
  onVote,
  suggestedFollowUps,
  isGeneratingFollowUps,
  summaryPhase,
  onFinalizeDiscussion,
  onExtendDiscussion,
  currentRounds,
  currentMode,
  currentDepth,
  currentKeywords,
  streamingMessage,
  startMarker,
  extensionMarkers,
}: DiscussionPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [turns, currentMessages, currentFinalAnswer]);

  if (turns.length === 0 && !currentTopic) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
        <div className="text-center">
          <div className="text-4xl md:text-6xl mb-3 md:mb-4">💬</div>
          <p className="text-sm md:text-base">議論を開始するには、トピックを入力してください</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0">
      {/* 過去のターン */}
      {turns.map((turn, index) => (
        <TurnDisplay
          key={turn.id}
          turn={turn}
          isLatest={index === turns.length - 1 && !currentTopic}
          defaultExpanded={false}
          onFollowUp={onFollowUp}
          onDeepDive={onDeepDive}
          onCounterargument={onCounterargument}
          onFork={onFork}
          onGenerateFollowUps={onGenerateFollowUps}
          disabled={isDiscussing}
          isGeneratingFollowUps={isGeneratingFollowUps}
          messageVotes={messageVotes}
          onVote={onVote}
        />
      ))}

      {/* 進行中のターン */}
      {currentTopic && (
        <CurrentTurnDisplay
          topic={currentTopic}
          messages={currentMessages}
          participants={participants}
          finalAnswer={currentFinalAnswer}
          summaryPrompt={currentSummaryPrompt}
          isDiscussing={isDiscussing}
          isInterrupting={isInterrupting}
          summaryPhase={summaryPhase}
          searchResults={searchResults}
          searchKeywords={searchKeywords}
          searchProgress={searchProgress}
          onFollowUp={onFollowUp}
          onDeepDive={onDeepDive}
          onCounterargument={onCounterargument}
          onFork={onFork}
          messageVotes={messageVotes}
          onVote={onVote}
          suggestedFollowUps={suggestedFollowUps}
          isGeneratingFollowUps={isGeneratingFollowUps}
          onFinalizeDiscussion={onFinalizeDiscussion}
          onExtendDiscussion={onExtendDiscussion}
          currentRounds={currentRounds}
          currentMode={currentMode}
          currentDepth={currentDepth}
          currentKeywords={currentKeywords}
          streamingMessage={streamingMessage}
          startMarker={startMarker}
          extensionMarkers={extensionMarkers}
        />
      )}
    </div>
  );
}
