'use client';

import { useState } from 'react';
import { SearchKeywordInfo } from '@/types';
import { InlineSearchResults } from './InlineSearchResults';

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
  const [showPromptIndex, setShowPromptIndex] = useState<number | null>(null);

  if (keywords.length === 0) return null;

  // 総検索結果件数を計算
  const totalResults = keywords.reduce((sum, info) => sum + (info.results?.length || 0), 0);

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Web検索を{isExpanded ? '折りたたむ' : '展開'}</span>
        <span className="text-xs text-gray-500">
          ({keywords.length}回検索
          {totalResults > 0 && `・${totalResults}件取得`})
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-purple-700/50 space-y-3">
          {keywords.map((info, index) => (
            <div
              key={`${info.timing}-${info.round || 0}-${index}`}
              className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-2 md:p-3"
            >
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-purple-400 text-xs font-medium bg-purple-700/30 px-2 py-0.5 rounded">
                  {TIMING_LABELS[info.timing]}
                  {info.timing === 'round' && info.round && ` ${info.round}`}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(info.timestamp).toLocaleTimeString('ja-JP')}
                </span>
                {info.prompt && (
                  <button
                    type="button"
                    onClick={() => setShowPromptIndex(showPromptIndex === index ? null : index)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-colors ${
                      showPromptIndex === index
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-purple-400 hover:bg-gray-700'
                    }`}
                    title="AIへのプロンプトを表示"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>Prompt</span>
                  </button>
                )}
              </div>

              {/* キーワード一覧 */}
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

              {/* プロンプト表示エリア */}
              {showPromptIndex === index && info.prompt && (
                <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {info.prompt}
                </div>
              )}

              {/* 検索結果（このタイミングで取得した結果） */}
              {info.results !== undefined && (
                <InlineSearchResults results={info.results} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
