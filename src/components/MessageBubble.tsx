'use client';

import { DiscussionMessage, DEFAULT_PROVIDERS, getOllamaModelColor } from '@/types';

interface MessageBubbleProps {
  message: DiscussionMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === message.provider);
  const isOllama = message.provider === 'ollama';
  const color = isOllama && message.model ? getOllamaModelColor(message.model) : (provider?.color || '#6B7280');
  const baseName = provider?.name || message.provider;
  const displayName = message.model ? `${baseName} (${message.model})` : baseName;

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
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>
      </div>
    </div>
  );
}
