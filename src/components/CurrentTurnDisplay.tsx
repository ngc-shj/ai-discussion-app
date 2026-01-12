'use client';

import { useState, useEffect, useRef } from 'react';
import { DiscussionMessage, DiscussionParticipant, SearchResult, SearchKeywordInfo, SearchProgress, MessageVote, FollowUpQuestion, DeepDiveType, SummaryState, formatParticipantDisplayName, ExtendDiscussionConfig, DiscussionMode, DiscussionDepth, StartMarker, ExtensionMarker } from '@/types';
import { StreamingMessage } from '@/hooks';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FollowUpSuggestions } from './FollowUpSuggestions';
import { DeepDiveModal } from './DeepDiveModal';
import { ExtendDiscussionModal } from './ExtendDiscussionModal';
import { CounterargumentButton } from './CounterargumentButton';
import { SearchResultsDisplay } from './SearchResultsDisplay';
import { SearchKeywordsDisplay } from './SearchKeywordsDisplay';
import { MessageList } from './MessageList';

interface CurrentTurnDisplayProps {
  topic: string;
  messages: DiscussionMessage[];
  participants?: DiscussionParticipant[]; // 実行中の参加者リスト
  finalAnswer?: string;
  summaryPrompt?: string;
  isLoading: boolean;
  isSearching?: boolean; // 検索中かどうか
  summaryState?: SummaryState;
  searchResults?: SearchResult[];
  searchKeywords?: SearchKeywordInfo[];
  searchProgress?: SearchProgress | null; // 検索進捗状態
  onFollowUp?: (topic: string, previousAnswer: string) => void;
  onDeepDive?: (topic: string, previousAnswer: string, type: DeepDiveType, customPrompt?: string) => void;
  onCounterargument?: (topic: string, previousAnswer: string) => void;
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  suggestedFollowUps?: FollowUpQuestion[];
  isGeneratingFollowUps?: boolean;
  onGenerateSummary?: () => void;
  onExtendDiscussion?: (config: ExtendDiscussionConfig) => void;
  currentRounds?: number;
  currentMode?: DiscussionMode;
  currentDepth?: DiscussionDepth;
  currentKeywords?: string[];
  streamingMessage?: StreamingMessage | null;
  startMarker?: StartMarker | null;
  extensionMarkers?: ExtensionMarker[];
}

export function CurrentTurnDisplay({
  topic,
  messages,
  participants,
  finalAnswer,
  summaryPrompt,
  isLoading,
  isSearching,
  summaryState,
  searchResults,
  searchKeywords,
  searchProgress,
  onFollowUp,
  onDeepDive,
  onCounterargument,
  messageVotes,
  onVote,
  suggestedFollowUps,
  isGeneratingFollowUps,
  onGenerateSummary,
  onExtendDiscussion,
  currentRounds = 0,
  currentMode,
  currentDepth,
  currentKeywords,
  streamingMessage,
  startMarker,
  extensionMarkers = [],
}: CurrentTurnDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [discussionCopied, setDiscussionCopied] = useState(false);
  const [isDeepDiveModalOpen, setIsDeepDiveModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
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
        .map(m => {
          // 参加者から表示名を取得、なければスナップショットまたはフォールバック
          const participant = participants?.find(p => p.id === m.participantId);
          const displayName = participant
            ? formatParticipantDisplayName(participant)
            : (m.displayName || m.model || m.provider);
          return `【${displayName}】\n${m.content}`;
        })
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

      {/* 検索キーワードを表示（検索中はプレースホルダー表示） */}
      {searchKeywords && searchKeywords.length > 0 ? (
        <SearchKeywordsDisplay keywords={searchKeywords} />
      ) : isSearching ? (
        <div className="ml-10 md:ml-13 mb-2 md:mb-3">
          <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>検索キーワードを生成中...</span>
          </div>
        </div>
      ) : null}

      {/* 検索結果を表示（検索中はプレースホルダー表示） */}
      {searchResults && searchResults.length > 0 && (
        <SearchResultsDisplay results={searchResults} />
      )}
      {/* 検索結果が0件の場合の表示（警告情報含む） */}
      {!isSearching && searchKeywords && searchKeywords.length > 0 && (!searchResults || searchResults.length === 0) && (
        <div className="ml-10 md:ml-13 mb-2 md:mb-3">
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-400 text-xs md:text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>検索結果が見つかりませんでした</span>
            </div>
            {/* 警告の詳細を表示 */}
            {searchProgress?.warnings && searchProgress.warnings.length > 0 ? (
              <div className="mt-2 ml-6 space-y-1">
                {searchProgress.warnings.some(w => w.type === 'rate_limited') && (
                  <p className="text-xs text-orange-400">
                    ⚠ 検索プロバイダーのレートリミットに達しました。しばらく待ってから再試行してください。
                  </p>
                )}
                {searchProgress.warnings.some(w => w.type === 'timeout') && (
                  <p className="text-xs text-orange-400">
                    ⚠ 検索がタイムアウトしました。ネットワーク接続を確認してください。
                  </p>
                )}
                {searchProgress.warnings.some(w => w.type === 'api_error') && (
                  <p className="text-xs text-orange-400">
                    ⚠ 検索APIでエラーが発生しました。
                  </p>
                )}
                {searchProgress.warnings.every(w => w.type === 'no_results') && (
                  <p className="text-xs text-gray-400">
                    指定されたキーワードに該当する結果がありませんでした。
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400 ml-6">
                検索キーワードを変更するか、別のトピックで試してみてください。
              </p>
            )}
          </div>
        </div>
      )}
      {isSearching && searchProgress && searchProgress.phase === 'searching' && (
        <div className="ml-10 md:ml-13 mb-2 md:mb-3">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs md:text-sm text-gray-300">
                Web検索中... ({searchProgress.currentKeywordIndex + 1}/{searchProgress.totalKeywords})
              </span>
            </div>
            {/* 進捗バー */}
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((searchProgress.currentKeywordIndex + 1) / searchProgress.totalKeywords) * 100}%` }}
              />
            </div>
            {/* 現在検索中のキーワード */}
            {searchProgress.currentKeyword && (
              <div className="text-xs text-gray-400">
                検索中: <span className="text-blue-400">{searchProgress.currentKeyword}</span>
              </div>
            )}
            {/* 完了したキーワード（警告があればマーク表示） */}
            {searchProgress.completedKeywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {searchProgress.completedKeywords.map((kw, i) => {
                  const hasWarning = searchProgress.warnings?.some(w => w.keyword === kw);
                  return (
                    <span
                      key={i}
                      className={`text-xs px-2 py-0.5 rounded ${
                        hasWarning
                          ? 'bg-yellow-900/30 text-yellow-400'
                          : 'bg-green-900/30 text-green-400'
                      }`}
                      title={hasWarning ? '結果なし' : ''}
                    >
                      {hasWarning ? '⚠' : '✓'} {kw}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
              {isLoading && summaryState !== 'generating' && (
                <div className="animate-spin w-3 h-3 border-2 border-gray-500 border-t-blue-400 rounded-full" />
              )}
            </button>
            {messages.length > 0 && (
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
            )}
          </div>

          {isExpanded && (
            <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-gray-700">
              <MessageList
                messages={messages}
                participants={participants}
                startMarker={startMarker}
                extensionMarkers={extensionMarkers}
                messageVotes={messageVotes}
                onVote={onVote}
                streamingMessage={streamingMessage}
                isLoading={isLoading}
                bottomRef={bottomRef}
              />
            </div>
          )}
        </div>
      )}

      {/* 統合回答待ち状態（投票を促すUI） */}
      {summaryState === 'awaiting' && !finalAnswer && (
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
                      「議論を延長」で追加ラウンドを実行、または「統合回答を生成」で結論をまとめます。
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {onExtendDiscussion && (
                    <button
                      type="button"
                      onClick={() => setIsExtendModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>議論を延長</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onGenerateSummary}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>統合回答を生成</span>
                  </button>
                </div>
              </div>
            </div>
            {/* 議論延長モーダル */}
            {onExtendDiscussion && (
              <ExtendDiscussionModal
                isOpen={isExtendModalOpen}
                onClose={() => setIsExtendModalOpen(false)}
                onExtend={onExtendDiscussion}
                currentRounds={maxRound}
                currentMode={currentMode}
                currentDepth={currentDepth}
                currentKeywords={currentKeywords}
              />
            )}
          </div>
        </div>
      )}

      {/* 統合回答または統合中表示 */}
      {(finalAnswer || summaryState === 'generating') && (
        <div className="flex gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-base md:text-lg">✨</span>
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="flex items-center mb-1">
              <span className="font-semibold text-purple-400 text-sm md:text-base">統合回答</span>
            </div>
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-700/50 rounded-lg p-2 md:p-3 text-gray-200 text-sm md:text-base">
              {summaryState === 'generating' && !finalAnswer ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-gray-500 border-t-purple-400 rounded-full" />
                  <span className="text-gray-400 text-sm md:text-base">議論を統合中...</span>
                </div>
              ) : (
                <MarkdownRenderer content={finalAnswer || ''} />
              )}
            </div>
            {/* コピー・プロンプト表示ボタン（統合完了後のみ） */}
            {finalAnswer && summaryState !== 'generating' && (
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
                {summaryPrompt && (
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
            )}
            {/* プロンプト表示エリア */}
            {showSummaryPrompt && summaryPrompt && (
              <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {summaryPrompt}
              </div>
            )}
            {/* アクションボタン（統合完了後のみ表示） */}
            {finalAnswer && summaryState !== 'generating' && !isLoading && (onDeepDive || onCounterargument) && (
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
            {finalAnswer && summaryState !== 'generating' && onFollowUp && (
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
