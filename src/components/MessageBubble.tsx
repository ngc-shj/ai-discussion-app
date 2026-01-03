'use client';

import { useState } from 'react';
import { DiscussionMessage, DiscussionParticipant, DEFAULT_PROVIDERS, getOllamaModelColor, formatParticipantDisplayName } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface MessageBubbleProps {
  message: DiscussionMessage;
  participants?: DiscussionParticipant[]; // 実行中は参加者リストから取得
  vote?: 'agree' | 'disagree' | 'neutral';
  onVote?: (vote: 'agree' | 'disagree' | 'neutral') => void;
}

export function MessageBubble({ message, participants, vote, onVote }: MessageBubbleProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === message.provider);
  const isOllama = message.provider === 'ollama';

  // 参加者を取得（実行中は participants から、履歴表示時はスナップショットを使用）
  const participant = participants?.find(p => p.id === message.participantId);

  // 色: 参加者から取得 → メッセージのスナップショット → フォールバック
  const color = participant?.color
    || message.color
    || (isOllama && message.model ? getOllamaModelColor(message.model) : (provider?.color || '#6B7280'));

  // 表示名: 参加者から取得 → メッセージのスナップショット → フォールバック
  const baseName = provider?.name || message.provider;
  const fallbackDisplayName = message.model ? `${baseName} (${message.model})` : baseName;
  const displayName = participant
    ? formatParticipantDisplayName(participant)
    : (message.displayName || fallbackDisplayName);

  return (
    <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
      <div
        className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shrink-0"
        style={{ backgroundColor: color }}
      >
        {baseName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold truncate text-sm md:text-base" style={{ color }} title={displayName}>
            {displayName}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            Round {message.round}
          </span>
        </div>
        <div className="bg-gray-800 rounded-lg p-2 md:p-3 text-gray-200 text-sm md:text-base">
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-white rounded-full" />
              <span className="text-gray-400">考え中...</span>
            </div>
          ) : message.isStreaming ? (
            <div>
              <MarkdownRenderer content={message.content} />
              <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />
            </div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
        {/* プロンプト表示ボタン・投票ボタン */}
        {!message.isLoading && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-1.5">
            {/* プロンプト表示トグル */}
            {message.prompt && (
              <button
                type="button"
                onClick={() => setShowPrompt(!showPrompt)}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                  showPrompt
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
        {showPrompt && message.prompt && (
          <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {message.prompt}
          </div>
        )}
        {/* 投票ボタン */}
        {onVote && !message.isLoading && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-1">
            <button
              type="button"
              onClick={() => onVote('agree')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                vote === 'agree'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-green-400 hover:bg-gray-700'
              }`}
              title="同意"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span className="hidden sm:inline">同意</span>
            </button>
            <button
              type="button"
              onClick={() => onVote('disagree')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                vote === 'disagree'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-red-400 hover:bg-gray-700'
              }`}
              title="反対"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
              <span className="hidden sm:inline">反対</span>
            </button>
            <button
              type="button"
              onClick={() => onVote('neutral')}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                vote === 'neutral'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
              }`}
              title="中立"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              <span className="hidden sm:inline">中立</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
