'use client';

import { RefObject } from 'react';
import { DiscussionMessage, DiscussionParticipant, MessageVote, StartMarker, ExtensionMarker } from '@/types';
import { StreamingMessage } from '@/hooks';
import { MessageBubble } from './MessageBubble';
import { StartSeparatorInline, ExtensionSeparatorInline } from './ExtensionSeparator';

interface MessageListProps {
  messages: DiscussionMessage[];
  participants?: DiscussionParticipant[];
  startMarker?: StartMarker | null;
  extensionMarkers?: ExtensionMarker[];
  messageVotes?: MessageVote[];
  onVote?: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  // リアルタイム表示用（CurrentTurnDisplay で使用）
  streamingMessage?: StreamingMessage | null;
  isLoading?: boolean;
  bottomRef?: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  messages,
  participants,
  startMarker,
  extensionMarkers = [],
  messageVotes,
  onVote,
  streamingMessage,
  isLoading,
  bottomRef,
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

  return (
    <>
      {/* 議論開始セパレーター */}
      {startMarker && (isLoading || messages.length > 0 || streamingMessage) && (
        <StartSeparatorInline marker={startMarker} />
      )}

      {/* メッセージ一覧 */}
      {messages.map((message, index) => {
        const extensionMarker = getExtensionMarkerForMessage(index, message);

        return (
          <div key={message.id}>
            {extensionMarker && (
              <ExtensionSeparatorInline marker={extensionMarker} />
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
        // 延長直後でまだ新ラウンドのメッセージがない場合に表示
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const pendingExtensionMarker = lastMessage
          ? extensionMarkers.find(m => m.afterRound === lastMessage.round)
          : null;
        // ストリーミング中または読み込み中で、まだこのマーカーに対応するメッセージがない場合
        if (pendingExtensionMarker && (isLoading || streamingMessage)) {
          const hasMessageAfterExtension = messages.some(msg => msg.round > pendingExtensionMarker.afterRound);
          if (!hasMessageAfterExtension) {
            return <ExtensionSeparatorInline marker={pendingExtensionMarker} />;
          }
        }
        return null;
      })()}

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
      {isLoading && messages.length === 0 && !streamingMessage && (
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
