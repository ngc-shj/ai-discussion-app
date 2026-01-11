'use client';

import { useEffect, useRef } from 'react';
import { DiscussionTurn, DiscussionMessage, DiscussionParticipant, SearchResult, MessageVote, FollowUpQuestion, DeepDiveType, SummaryState } from '@/types';
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
  isLoading: boolean;
  searchResults?: SearchResult[];
  onFollowUp?: (topic: string, previousAnswer: string) => void;
  onDeepDive?: (topic: string, previousAnswer: string, type: DeepDiveType, customPrompt?: string) => void;
  onCounterargument?: (topic: string, previousAnswer: string) => void;
  onFork?: (turnId: string, topic: string, previousAnswer: string, label: string, perspective: string) => void;
  onGenerateFollowUps?: (turnId: string, topic: string, finalAnswer: string) => void;
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  suggestedFollowUps?: FollowUpQuestion[];
  isGeneratingFollowUps?: boolean;
  summaryState?: SummaryState;
  onGenerateSummary?: () => void;
  streamingMessage?: StreamingMessage | null;
}

export function DiscussionPanel({
  turns,
  currentMessages,
  participants,
  currentTopic,
  currentFinalAnswer,
  currentSummaryPrompt,
  isLoading,
  searchResults,
  onFollowUp,
  onDeepDive,
  onCounterargument,
  onFork,
  onGenerateFollowUps,
  messageVotes,
  onVote,
  suggestedFollowUps,
  isGeneratingFollowUps,
  summaryState,
  onGenerateSummary,
  streamingMessage,
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
          disabled={isLoading}
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
          isLoading={isLoading}
          summaryState={summaryState}
          searchResults={searchResults}
          onFollowUp={onFollowUp}
          onDeepDive={onDeepDive}
          onCounterargument={onCounterargument}
          messageVotes={messageVotes}
          onVote={onVote}
          suggestedFollowUps={suggestedFollowUps}
          isGeneratingFollowUps={isGeneratingFollowUps}
          onGenerateSummary={onGenerateSummary}
          streamingMessage={streamingMessage}
        />
      )}
    </div>
  );
}
