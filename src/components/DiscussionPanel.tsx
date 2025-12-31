'use client';

import { useEffect, useRef, useState } from 'react';
import { DiscussionMessage, DiscussionTurn } from '@/types';
import { MessageBubble } from './MessageBubble';

interface DiscussionPanelProps {
  turns: DiscussionTurn[];
  currentMessages: DiscussionMessage[];
  currentTopic?: string;
  currentFinalAnswer?: string;
  isLoading: boolean;
  isSummarizing: boolean;
}

// 単一のターンを表示するコンポーネント
function TurnDisplay({
  turn,
  isLatest,
  defaultExpanded,
}: {
  turn: DiscussionTurn;
  isLatest: boolean;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [discussionCopied, setDiscussionCopied] = useState(false);

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
          </div>

          {isExpanded && (
            <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-gray-700 max-h-48 md:max-h-64 overflow-y-auto">
              {turn.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
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
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-purple-400 text-sm md:text-base">統合回答</span>
            </div>
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-700/50 rounded-lg text-gray-200 text-sm md:text-base relative">
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
              <div className="px-2 pb-2 md:px-3 md:pb-3 whitespace-pre-wrap">{turn.finalAnswer}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 進行中のターンを表示するコンポーネント
function CurrentTurnDisplay({
  topic,
  messages,
  finalAnswer,
  isLoading,
  isSummarizing,
}: {
  topic: string;
  messages: DiscussionMessage[];
  finalAnswer?: string;
  isLoading: boolean;
  isSummarizing: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [discussionCopied, setDiscussionCopied] = useState(false);

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
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && messages.length === 0 && (
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

      {/* 統合回答または統合中表示 */}
      {(finalAnswer || isSummarizing) && (
        <div className="flex gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white text-base md:text-lg">✨</span>
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-purple-400 text-sm md:text-base">統合回答</span>
            </div>
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-purple-700/50 rounded-lg text-gray-200 text-sm md:text-base relative">
              {isSummarizing && !finalAnswer ? (
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
                  <div className="px-2 pb-2 md:px-3 md:pb-3 whitespace-pre-wrap">{finalAnswer}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DiscussionPanel({
  turns,
  currentMessages,
  currentTopic,
  currentFinalAnswer,
  isLoading,
  isSummarizing,
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
        />
      ))}

      {/* 進行中のターン */}
      {currentTopic && (
        <CurrentTurnDisplay
          topic={currentTopic}
          messages={currentMessages}
          finalAnswer={currentFinalAnswer}
          isLoading={isLoading}
          isSummarizing={isSummarizing}
        />
      )}
    </div>
  );
}
