'use client';

import { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface FinalAnswerProps {
  answer: string;
  isLoading: boolean;
}

export function FinalAnswer({ answer, isLoading }: FinalAnswerProps) {
  const [copied, setCopied] = useState(false);

  if (!answer && !isLoading) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="mx-3 mb-3 p-3 md:mx-4 md:mb-4 md:p-4 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700 rounded-lg">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <span className="text-white text-base md:text-lg">✨</span>
          </div>
          <h3 className="text-base md:text-lg font-semibold text-white">統合回答</h3>
        </div>
        {!isLoading && answer && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-600/50 rounded-md transition-colors"
            title="回答をコピー"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline">コピーしました</span>
                <span className="sm:hidden">完了</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>コピー</span>
              </>
            )}
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-300 text-sm md:text-base">
          <div className="animate-spin w-4 h-4 md:w-5 md:h-5 border-2 border-gray-500 border-t-blue-400 rounded-full" />
          <span>議論を統合中...</span>
        </div>
      ) : (
        <div className="max-h-64 md:max-h-96 overflow-y-auto text-gray-200 text-sm md:text-base">
          <MarkdownRenderer content={answer} />
        </div>
      )}
    </div>
  );
}
