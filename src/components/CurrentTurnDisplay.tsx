'use client';

import { useState, useEffect, useRef } from 'react';
import { DiscussionMessage, SearchResult, MessageVote, FollowUpQuestion, DeepDiveType } from '@/types';
import { StreamingMessage } from '@/hooks';
import { MessageBubble } from './MessageBubble';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FollowUpSuggestions } from './FollowUpSuggestions';
import { DeepDiveModal } from './DeepDiveModal';
import { CounterargumentButton } from './CounterargumentButton';
import { SearchResultsDisplay } from './SearchResultsDisplay';

interface CurrentTurnDisplayProps {
  topic: string;
  messages: DiscussionMessage[];
  finalAnswer?: string;
  summaryPrompt?: string;
  isLoading: boolean;
  isSummarizing: boolean;
  searchResults?: SearchResult[];
  onFollowUp?: (topic: string, previousAnswer: string) => void;
  onDeepDive?: (topic: string, previousAnswer: string, type: DeepDiveType, customPrompt?: string) => void;
  onCounterargument?: (topic: string, previousAnswer: string) => void;
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  suggestedFollowUps?: FollowUpQuestion[];
  isGeneratingFollowUps?: boolean;
  awaitingSummary?: boolean;
  isGeneratingSummary?: boolean;
  onGenerateSummary?: () => void;
  streamingMessage?: StreamingMessage | null;
}

export function CurrentTurnDisplay({
  topic,
  messages,
  finalAnswer,
  summaryPrompt,
  isLoading,
  isSummarizing,
  searchResults,
  onFollowUp,
  onDeepDive,
  onCounterargument,
  messageVotes,
  onVote,
  suggestedFollowUps,
  isGeneratingFollowUps,
  awaitingSummary,
  isGeneratingSummary,
  onGenerateSummary,
  streamingMessage,
}: CurrentTurnDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [discussionCopied, setDiscussionCopied] = useState(false);
  const [isDeepDiveModalOpen, setIsDeepDiveModalOpen] = useState(false);
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const maxRound = messages.length > 0 ? Math.max(...messages.map(m => m.round)) : 0;
  const participantCount = new Set(messages.map(m => `${m.provider}-${m.model}`)).size;

  const handleCopy = async () => {
    if (!finalAnswer) return;
    try {
      await navigator.clipboard.writeText(finalAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyDiscussion = async () => {
    try {
      const discussionText = messages
        .map(m => `【${m.model || m.provider}】\n${m.content}`)
        .join('\n\n');
      await navigator.clipboard.writeText(discussionText);
      setDiscussionCopied(true);
      setTimeout(() => setDiscussionCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy discussion:', err);
    }
  };

  return (
    <div className="mb-3 md:mb-4">
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
            <div className="whitespace-pre-wrap">{topic}</div>
          </div>
        </div>
      </div>

      {/* 検索結果を表示 */}
      {searchResults && searchResults.length > 0 && (
        <SearchResultsDisplay results={searchResults} />
      )}

      {/* AIの議論（折りたたみ） */}
      {(messages.length > 0 || isLoading) && (
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
              {messages.length > 0 && (
                <span className="text-xs text-gray-600">
                  ({participantCount}<span className="hidden sm:inline">モデル</span> × {maxRound}<span className="hidden sm:inline">ラウンド</span>)
                </span>
              )}
              {isLoading && !isSummarizing && (
                <div className="animate-spin w-3 h-3 border-2 border-gray-500 border-t-blue-400 rounded-full" />
              )}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleCopyDiscussion}
                className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 text-xs text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600/50 rounded transition-all"
                title="議論をコピー"
              >
                {discussionCopied ? (
                  <>
                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="hidden sm:inline">コピー済</span>
                  </>
                ) : (
                  <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {isExpanded && (
            <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-gray-700 max-h-48 md:max-h-64 overflow-y-auto">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  vote={messageVotes?.find(v => v.messageId === message.id)?.vote}
                  onVote={onVote ? (vote) => onVote(message.id, vote) : undefined}
                />
              ))}
              {streamingMessage && (
                <MessageBubble
                  key={streamingMessage.messageId}
                  message={{
                    id: streamingMessage.messageId,
                    provider: 'ollama',
                    content: streamingMessage.content,
                    round: 0,
                    timestamp: new Date(),
                    isStreaming: true,
                  }}
                />
              )}
              {isLoading && messages.length === 0 && !streamingMessage && (
                <div className="flex items-center gap-2 py-3 md:py-4">
                  <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-gray-500 border-t-blue-400 rounded-full" />
                  <span className="text-gray-400 text-sm md:text-base">議論を開始中...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      )}

      {/* 統合回答待ち状態（投票を促すUI） */}
      {awaitingSummary && !finalAnswer && !isSummarizing && (
        <div className="flex gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-base md:text-lg">✨</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-700/50 rounded-lg p-3 md:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-purple-300 mb-1">議論が完了しました</p>
                    <p className="text-gray-400">
                      各AIの意見に対して投票（同意・反対・中立）を行うと、統合回答に反映されます。
                      投票が完了したら「統合回答を生成」ボタンをクリックしてください。
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onGenerateSummary}
                    disabled={isGeneratingSummary}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>統合回答を生成</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 統合回答または統合中表示 */}
      {(finalAnswer || isSummarizing || isGeneratingSummary) && (
        <div className="flex gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-base md:text-lg">✨</span>
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-purple-400 text-sm md:text-base">統合回答</span>
                {summaryPrompt && !isSummarizing && (
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
            </div>
            {/* プロンプト表示エリア */}
            {showSummaryPrompt && summaryPrompt && (
              <div className="mb-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {summaryPrompt}
              </div>
            )}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-700/50 rounded-lg text-gray-200 text-sm md:text-base relative">
              {(isSummarizing || isGeneratingSummary) && !finalAnswer ? (
                <div className="flex items-center gap-2 p-2 md:p-3">
                  <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-gray-500 border-t-purple-400 rounded-full" />
                  <span className="text-gray-400 text-sm md:text-base">議論を統合中...</span>
                </div>
              ) : (
                <>
                  {/* 固定コピーボタン */}
                  <div className="sticky top-0 z-10 flex justify-end p-1.5 md:p-2 pb-0">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 text-xs text-gray-400 hover:text-white bg-gray-700/90 hover:bg-gray-600/90 rounded transition-all shadow-sm"
                      title="コピー"
                    >
                      {copied ? (
                        <>
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="hidden sm:inline">コピー済</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>コピー</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="px-2 pb-2 md:px-3 md:pb-3">
                    <MarkdownRenderer content={finalAnswer || ''} />
                  </div>
                </>
              )}
            </div>
            {/* アクションボタン（統合完了後のみ表示） */}
            {finalAnswer && !isSummarizing && !isLoading && (onDeepDive || onCounterargument) && (
              <div className="mt-2 flex justify-end gap-2 flex-wrap">
                {onDeepDive && (
                  <button
                    type="button"
                    onClick={() => setIsDeepDiveModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm text-purple-300 hover:text-white bg-purple-900/50 hover:bg-purple-800/50 border border-purple-700/50 rounded-lg transition-colors"
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
                    onClick={() => onCounterargument(topic, finalAnswer)}
                  />
                )}
              </div>
            )}
            {/* DeepDiveModal */}
            {finalAnswer && onDeepDive && (
              <DeepDiveModal
                isOpen={isDeepDiveModalOpen}
                onClose={() => setIsDeepDiveModalOpen(false)}
                onStartDeepDive={(type, customPrompt) => onDeepDive(topic, finalAnswer, type, customPrompt)}
                topic={topic}
              />
            )}
            {/* フォローアップ質問候補 */}
            {finalAnswer && !isSummarizing && onFollowUp && (
              <FollowUpSuggestions
                questions={suggestedFollowUps || []}
                onSelect={(question) => onFollowUp(question, finalAnswer)}
                disabled={isLoading}
                isLoading={isGeneratingFollowUps}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
