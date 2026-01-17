'use client';

import { useState } from 'react';
import { SearchKeywordInfo } from '@/types';
import { SearchKeywordItem } from './SearchKeywordItem';

interface SearchResultsAccordionProps {
  searchKeywords: SearchKeywordInfo[];
}

const TIMING_LABELS: Record<SearchKeywordInfo['timing'], string> = {
  start: '開始時検索',
  round: 'ラウンド検索',
  summary: '統合前検索',
};

/**
 * 全検索結果をインライン展開で表示するコンポーネント
 * 統合回答完了後に「検索結果を見る」として使用
 */
export function SearchResultsAccordion({ searchKeywords }: SearchResultsAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (searchKeywords.length === 0) {
    return null;
  }

  // タイミング別にグループ化
  const startKeywords = searchKeywords.filter(kw => kw.timing === 'start');
  const roundKeywords = searchKeywords.filter(kw => kw.timing === 'round');
  const summaryKeywords = searchKeywords.filter(kw => kw.timing === 'summary');

  // 有効な検索結果の総数を計算（filtered=trueを除外）
  const totalRelevantResults = searchKeywords.reduce((sum, kw) => {
    const relevantCount = kw.results?.filter(r => !r.filtered).length || 0;
    return sum + relevantCount;
  }, 0);

  return (
    <div className="mt-3">
      {/* 展開ボタン */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-cyan-500 hover:text-cyan-300 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>検索結果を{isExpanded ? '折りたたむ' : '見る'}</span>
        <span className="text-gray-500">
          ({searchKeywords.length}回検索、有効{totalRelevantResults}件)
        </span>
      </button>

      {/* 展開コンテンツ */}
      {isExpanded && (
        <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto border-l-2 border-cyan-700/50 pl-3">
          {/* 開始時検索 */}
          {startKeywords.length > 0 && (
            <SearchSection
              label={TIMING_LABELS.start}
              keywords={startKeywords}
              defaultExpanded={true}
            />
          )}

          {/* ラウンド検索 */}
          {roundKeywords.length > 0 && (
            <SearchSection
              label={TIMING_LABELS.round}
              keywords={roundKeywords}
              defaultExpanded={false}
            />
          )}

          {/* 統合前検索 */}
          {summaryKeywords.length > 0 && (
            <SearchSection
              label={TIMING_LABELS.summary}
              keywords={summaryKeywords}
              defaultExpanded={true}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 検索セクション（開始時/ラウンド/統合前ごとにグループ化）
 */
function SearchSection({
  label,
  keywords,
  defaultExpanded,
}: {
  label: string;
  keywords: SearchKeywordInfo[];
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 有効な検索結果の総数を計算（filtered=trueを除外）
  const totalRelevantResults = keywords.reduce((sum, kw) => {
    const relevantCount = kw.results?.filter(r => !r.filtered).length || 0;
    return sum + relevantCount;
  }, 0);

  return (
    <div className="bg-gray-800/30 rounded-lg p-2">
      {/* セクションヘッダー */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left text-sm text-gray-300 hover:text-white transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">{label}</span>
        <span className="text-xs text-gray-500">
          ({keywords.length}回、有効{totalRelevantResults}件)
        </span>
      </button>

      {/* セクションコンテンツ */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {keywords.map((keyword, index) => (
            <SearchKeywordItem
              key={`${keyword.timing}-${keyword.round || ''}-${index}`}
              keyword={keyword}
            />
          ))}
        </div>
      )}
    </div>
  );
}
