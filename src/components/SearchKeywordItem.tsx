'use client';

import { useState } from 'react';
import { SearchKeywordInfo } from '@/types';
import { InlineSearchResults } from './InlineSearchResults';

interface SearchKeywordItemProps {
  keyword: SearchKeywordInfo;
}

const TIMING_LABELS: Record<SearchKeywordInfo['timing'], string> = {
  start: '開始時',
  round: 'ラウンド',
  summary: '統合前',
};

/**
 * 単一の検索キーワード情報と結果を表示するコンポーネント
 * MessageList内でインラインで使用される
 */
export function SearchKeywordItem({ keyword }: SearchKeywordItemProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="my-2 md:my-3">
      <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-2 md:p-3">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-purple-400 text-xs font-medium bg-purple-700/30 px-2 py-0.5 rounded">
            {TIMING_LABELS[keyword.timing]}
            {keyword.timing === 'round' && keyword.round && ` ${keyword.round}`}
          </span>
          <span className="text-gray-500 text-xs">
            {new Date(keyword.timestamp).toLocaleTimeString('ja-JP')}
          </span>
          {keyword.prompt && (
            <button
              type="button"
              onClick={() => setShowPrompt(!showPrompt)}
              className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-colors ${
                showPrompt
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
          {keyword.keywords.map((kw, kIndex) => (
            <span
              key={kIndex}
              className="text-gray-300 text-xs bg-gray-700/50 px-2 py-1 rounded"
            >
              {kw}
            </span>
          ))}
        </div>

        {/* プロンプト表示エリア */}
        {showPrompt && keyword.prompt && (
          <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {keyword.prompt}
          </div>
        )}

        {/* 検索結果（このタイミングで取得した結果） */}
        {keyword.results !== undefined && (
          <InlineSearchResults results={keyword.results} fetchedCount={keyword.fetchedCount} />
        )}
      </div>
    </div>
  );
}
