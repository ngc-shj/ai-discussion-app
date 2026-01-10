'use client';

import { useState } from 'react';
import { DiscussionTurn, MessageVote, DeepDiveType } from '@/types';
import { MessageBubble } from './MessageBubble';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FollowUpSuggestions } from './FollowUpSuggestions';
import { DeepDiveModal } from './DeepDiveModal';
import { CounterargumentButton } from './CounterargumentButton';
import { ForkButton } from './ForkButton';
import { ForkModal } from './ForkModal';
import { SearchResultsDisplay } from './SearchResultsDisplay';

interface TurnDisplayProps {
  turn: DiscussionTurn;
  isLatest: boolean;
  defaultExpanded: boolean;
  onFollowUp?: (topic: string, previousAnswer: string) => void;
  onDeepDive?: (topic: string, previousAnswer: string, type: DeepDiveType, customPrompt?: string) => void;
  onCounterargument?: (topic: string, previousAnswer: string) => void;
  onFork?: (turnId: string, topic: string, previousAnswer: string, label: string, perspective: string) => void;
  disabled?: boolean;
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
}

export function TurnDisplay({
  turn,
  isLatest,
  defaultExpanded,
  onFollowUp,
  onDeepDive,
  onCounterargument,
  onFork,
  disabled,
  messageVotes,
  onVote,
}: TurnDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [discussionCopied, setDiscussionCopied] = useState(false);
  const [isDeepDiveModalOpen, setIsDeepDiveModalOpen] = useState(false);
  const [isForkModalOpen, setIsForkModalOpen] = useState(false);
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false);

  const maxRound = turn.messages.length > 0 ? Math.max(...turn.messages.map(m => m.round)) : 0;
  const participantCount = new Set(turn.messages.map(m => `${m.provider}-${m.model}`)).size;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(turn.finalAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyDiscussion = async () => {
    try {
      const discussionText = turn.messages
        .map(m => `【${m.displayName || m.model || m.provider}】\n${m.content}`)
        .join('\n\n');
      await navigator.clipboard.writeText(discussionText);
      setDiscussionCopied(true);
      setTimeout(() => setDiscussionCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy discussion:', err);
    }
  };

  return (
    <div className={`mb-3 md:mb-4 ${isLatest ? '' : 'opacity-80'}`}>
      {/* ユーザーのトピック */}
      <div className="flex gap-2 md:gap-3 mb-2 md:mb-3">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-blue-600 text-white font-bold text-xs md:text-sm shrink-0">
          U
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-blue-400 text-sm md:text-base">あなた</span>
          </div>
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-2 md:p-3 text-gray-200 text-sm md:text-base">
            <div className="whitespace-pre-wrap">{turn.topic}</div>
          </div>
        </div>
      </div>

      {/* 検索結果を表示（過去のターン） */}
      {turn.searchResults && turn.searchResults.length > 0 && (
        <SearchResultsDisplay results={turn.searchResults} />
      )}

      {/* AIの議論（折りたたみ） */}
      {turn.messages.length > 0 && (
        <div className="ml-10 md:ml-13 mb-2 md:mb-3">
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="hidden sm:inline">AIの議論を{isExpanded ? '折りたたむ' : '展開'}</span>
              <span className="sm:hidden">{isExpanded ? '折りたたむ' : '展開'}</span>
              <span className="text-xs text-gray-600">
                ({participantCount}<span className="hidden sm:inline">モデル</span> × {maxRound}<span className="hidden sm:inline">ラウンド</span>)
              </span>
            </button>
            <button
              type="button"
              onClick={handleCopyDiscussion}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                discussionCopied
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-blue-400 hover:bg-gray-700'
              }`}
              title="議論をコピー"
            >
              {discussionCopied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline">コピー完了</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">議論をコピー</span>
                </>
              )}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-gray-700">
              {turn.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  vote={messageVotes?.find(v => v.messageId === message.id)?.vote}
                  onVote={onVote ? (vote) => onVote(message.id, vote) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 統合回答 */}
      {turn.finalAnswer && (
        <div className="flex gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-base md:text-lg">✨</span>
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="flex items-center mb-1">
              <span className="font-semibold text-purple-400 text-sm md:text-base">統合回答</span>
            </div>
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-700/50 rounded-lg p-2 md:p-3 text-gray-200 text-sm md:text-base">
              <MarkdownRenderer content={turn.finalAnswer} />
            </div>
            {/* コピー・プロンプト表示ボタン */}
            <div className="flex items-center gap-1 mt-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-blue-400 hover:bg-gray-700'
                }`}
                title="コピー"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="hidden sm:inline">コピー完了</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">コピー</span>
                  </>
                )}
              </button>
              {turn.summaryPrompt && (
                <button
                  type="button"
                  onClick={() => setShowSummaryPrompt(!showSummaryPrompt)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                    showSummaryPrompt
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-purple-400 hover:bg-gray-700'
                  }`}
                  title="プロンプトを表示"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="hidden sm:inline">Prompt</span>
                </button>
              )}
            </div>
            {/* プロンプト表示エリア */}
            {showSummaryPrompt && turn.summaryPrompt && (
              <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {turn.summaryPrompt}
              </div>
            )}
            {/* アクションボタン */}
            {(onDeepDive || onCounterargument || onFork) && (
              <div className="mt-2 flex justify-end gap-2 flex-wrap">
                {onDeepDive && (
                  <button
                    type="button"
                    onClick={() => setIsDeepDiveModalOpen(true)}
                    disabled={disabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm text-purple-300 hover:text-white bg-purple-900/50 hover:bg-purple-800/50 border border-purple-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="この回答について深掘りする"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                    </svg>
                    <span>深掘りする</span>
                  </button>
                )}
                {onCounterargument && (
                  <CounterargumentButton
                    onClick={() => onCounterargument(turn.topic, turn.finalAnswer)}
                    disabled={disabled}
                  />
                )}
                {onFork && (
                  <ForkButton
                    onClick={() => setIsForkModalOpen(true)}
                    disabled={disabled}
                  />
                )}
              </div>
            )}
            {/* DeepDiveModal */}
            {onDeepDive && (
              <DeepDiveModal
                isOpen={isDeepDiveModalOpen}
                onClose={() => setIsDeepDiveModalOpen(false)}
                onStartDeepDive={(type, customPrompt) => onDeepDive(turn.topic, turn.finalAnswer, type, customPrompt)}
                topic={turn.topic}
              />
            )}
            {/* ForkModal */}
            {onFork && (
              <ForkModal
                isOpen={isForkModalOpen}
                onClose={() => setIsForkModalOpen(false)}
                onCreateFork={(label, perspective) => onFork(turn.id, turn.topic, turn.finalAnswer, label, perspective)}
                topic={turn.topic}
              />
            )}
            {/* フォローアップ質問候補 */}
            {turn.suggestedFollowUps && turn.suggestedFollowUps.length > 0 && onFollowUp && (
              <FollowUpSuggestions
                questions={turn.suggestedFollowUps}
                onSelect={(question) => onFollowUp(question, turn.finalAnswer)}
                disabled={disabled}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
