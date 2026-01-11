'use client';

import { useState } from 'react';
import { SearchKeywordInfo } from '@/types';

interface SearchKeywordsDisplayProps {
  keywords: SearchKeywordInfo[];
}

const TIMING_LABELS: Record<SearchKeywordInfo['timing'], string> = {
  start: '開始時',
  round: 'ラウンド',
  summary: '統合前',
};

export function SearchKeywordsDisplay({ keywords }: SearchKeywordsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (keywords.length === 0) return null;

  return (
    <div className="ml-10 md:ml-13 mb-2 md:mb-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-purple-500 hover:text-purple-300 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        <span>検索キーワードを{isExpanded ? '折りたたむ' : '展開'}</span>
        <span className="text-xs text-gray-500">({keywords.length}回)</span>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-purple-700/50 space-y-2">
          {keywords.map((info, index) => (
            <div
              key={`${info.timing}-${info.round || 0}-${index}`}
              className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-2 md:p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-purple-400 text-xs font-medium bg-purple-700/30 px-2 py-0.5 rounded">
                  {TIMING_LABELS[info.timing]}
                  {info.timing === 'round' && info.round && ` ${info.round}`}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(info.timestamp).toLocaleTimeString('ja-JP')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {info.keywords.map((keyword, kIndex) => (
                  <span
                    key={kIndex}
                    className="text-gray-300 text-xs bg-gray-700/50 px-2 py-1 rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
