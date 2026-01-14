'use client';

import { useState } from 'react';
import { SearchResult } from '@/types';
import { InlineSearchResults } from './InlineSearchResults';

interface SearchResultsDisplayProps {
  results: SearchResult[];
  filteredCount?: number;  // フィルタで除外された件数（後方互換用）
}

/**
 * 検索結果を展開/折りたたみ可能な形式で表示するコンポーネント
 * メッセージ間に表示される（開始時の検索結果など）
 */
export function SearchResultsDisplay({ results }: SearchResultsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (results.length === 0) return null;

  // 有効な結果と除外された結果の件数
  const relevantCount = results.filter(r => !r.filtered).length;
  const filteredCount = results.filter(r => r.filtered).length;

  return (
    <div className="ml-10 md:ml-13 mb-2 md:mb-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm transition-colors text-cyan-500 hover:text-cyan-300"
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
        <span>
          Web検索結果を{isExpanded ? '折りたたむ' : '展開'}
        </span>
        <span className="text-xs text-gray-500">
          ({relevantCount}件
          {filteredCount > 0 && (
            <span className="text-orange-400">+{filteredCount}件除外</span>
          )}
          )
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-cyan-700/50">
          <InlineSearchResults results={results} defaultExpanded />
        </div>
      )}
    </div>
  );
}
