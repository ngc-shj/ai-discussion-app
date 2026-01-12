'use client';

import { RefObject } from 'react';
import { DiscussionMessage, DiscussionParticipant, MessageVote, StartMarker, ExtensionMarker, SearchKeywordInfo, SearchProgress } from '@/types';
import { StreamingMessage } from '@/hooks';
import { MessageBubble } from './MessageBubble';
import { StartSeparatorInline, ExtensionSeparatorInline } from './ExtensionSeparator';
import { SearchKeywordItem } from './SearchKeywordItem';

// 検索進捗インジケーターコンポーネント
function SearchProgressIndicator({ searchProgress }: { searchProgress: SearchProgress }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 my-2">
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
  );
}

// キーワード生成中インジケーター
function KeywordGeneratingIndicator() {
  return (
    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-500 py-2">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span>検索キーワードを生成中...</span>
    </div>
  );
}

interface MessageListProps {
  messages: DiscussionMessage[];
  participants?: DiscussionParticipant[];
  startMarker?: StartMarker | null;
  extensionMarkers?: ExtensionMarker[];
  searchKeywords?: SearchKeywordInfo[];
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  // リアルタイム表示用（CurrentTurnDisplay で使用）
  streamingMessage?: StreamingMessage | null;
  isLoading?: boolean;
  bottomRef?: RefObject<HTMLDivElement | null>;
  // 検索中状態の表示用
  searchProgress?: SearchProgress | null;
}

export function MessageList({
  messages,
  participants,
  startMarker,
  extensionMarkers = [],
  searchKeywords = [],
  messageVotes,
  onVote,
  streamingMessage,
  isLoading,
  bottomRef,
  searchProgress,
}: MessageListProps) {
  // 延長セパレーターを表示すべきか判定するヘルパー関数
  const getExtensionMarkerForMessage = (
    index: number,
    currentMessage: DiscussionMessage
  ): ExtensionMarker | undefined => {
    if (index === 0) return undefined;
    const prevMessage = messages[index - 1];
    return extensionMarkers.find(
      m => m.afterRound === prevMessage.round && currentMessage.round > prevMessage.round
    );
  };

  // 該当ラウンドの検索キーワードを取得
  const getSearchKeywordForRound = (round: number): SearchKeywordInfo | undefined => {
    return searchKeywords.find(kw => kw.timing === 'round' && kw.round === round);
  };

  // 開始時の検索キーワードを取得
  const startSearchKeyword = searchKeywords.find(kw => kw.timing === 'start');

  // 次のラウンド番号を計算
  const lastMessageRound = messages.length > 0 ? messages[messages.length - 1].round : 0;
  const nextRound = lastMessageRound + 1;

  // 次のラウンドのメッセージが完了しているかチェック（ストリーミング中は未完了）
  const hasCompletedNextRoundMessage = messages.some(m => m.round === nextRound);

  // 次のラウンドの検索キーワード（まだメッセージが完了していない場合に表示用）
  const pendingRoundSearchKeyword = !hasCompletedNextRoundMessage
    ? getSearchKeywordForRound(nextRound)
    : undefined;

  // 表示すべき検索キーワード（開始時 or 延長時）
  const pendingSearchKeyword = messages.length === 0 ? startSearchKeyword : pendingRoundSearchKeyword;

  return (
    <>
      {/* 議論開始セパレーター */}
      {startMarker && (isLoading || messages.length > 0 || streamingMessage) && (
        <StartSeparatorInline marker={startMarker} />
      )}

      {/* 開始時の検索キーワード（メッセージがある場合に表示、履歴表示用） */}
      {startSearchKeyword && messages.length > 0 && (
        <SearchKeywordItem keyword={startSearchKeyword} />
      )}

      {/* メッセージ一覧 */}
      {messages.map((message, index) => {
        const extensionMarker = getExtensionMarkerForMessage(index, message);
        // このメッセージがラウンドの最初のメッセージか判定
        const isFirstMessageOfRound = index === 0 || messages[index - 1].round !== message.round;
        // ラウンド用の検索キーワード（ラウンドの最初のメッセージ前に表示）
        const roundSearchKeyword = isFirstMessageOfRound ? getSearchKeywordForRound(message.round) : undefined;

        return (
          <div key={message.id}>
            {extensionMarker && (
              <ExtensionSeparatorInline marker={extensionMarker} />
            )}
            {/* ラウンドの検索結果（延長マーカーの後、メッセージの前） */}
            {roundSearchKeyword && (
              <SearchKeywordItem keyword={roundSearchKeyword} />
            )}
            <MessageBubble
              message={message}
              participants={participants}
              vote={messageVotes?.find(v => v.messageId === message.id)?.vote}
              onVote={onVote ? (vote) => onVote(message.id, vote) : undefined}
            />
          </div>
        );
      })}

      {/* 延長セパレーター（延長開始時、最初のメッセージ完了前に表示） */}
      {(() => {
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const pendingExtensionMarker = lastMessage
          ? extensionMarkers.find(m => m.afterRound === lastMessage.round)
          : null;
        if (pendingExtensionMarker && (isLoading || streamingMessage || searchProgress)) {
          const hasMessageAfterExtension = messages.some(msg => msg.round > pendingExtensionMarker.afterRound);
          if (!hasMessageAfterExtension) {
            return <ExtensionSeparatorInline marker={pendingExtensionMarker} />;
          }
        }
        return null;
      })()}

      {/* 検索キーワード生成中インジケーター */}
      {!pendingSearchKeyword && searchProgress?.phase === 'keywords' && (
        <KeywordGeneratingIndicator />
      )}

      {/* 検索キーワード（メッセージがまだない場合） */}
      {pendingSearchKeyword && (
        <SearchKeywordItem keyword={pendingSearchKeyword} />
      )}

      {/* 検索進捗インジケーター */}
      {searchProgress?.phase === 'searching' && (
        <SearchProgressIndicator searchProgress={searchProgress} />
      )}

      {/* ストリーミング中のメッセージ */}
      {streamingMessage && (
        <MessageBubble
          key={streamingMessage.messageId}
          participants={participants}
          message={{
            id: streamingMessage.messageId,
            participantId: streamingMessage.participantId,
            provider: streamingMessage.provider as import('@/types').AIProviderType,
            model: streamingMessage.model,
            content: streamingMessage.content,
            round: streamingMessage.round,
            timestamp: new Date(),
            isStreaming: true,
          }}
        />
      )}

      {/* 議論開始中のローディング */}
      {isLoading && messages.length === 0 && !streamingMessage && !searchProgress && (
        <div className="flex items-center gap-2 py-3 md:py-4">
          <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-gray-500 border-t-blue-400 rounded-full" />
          <span className="text-gray-400 text-sm md:text-base">議論を開始中...</span>
        </div>
      )}

      {/* スクロール用ref */}
      {bottomRef && <div ref={bottomRef} />}
    </>
  );
}
