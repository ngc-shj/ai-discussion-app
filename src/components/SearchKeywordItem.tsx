'use client';

import { useState } from 'react';
import { SearchKeywordInfo, SearchResult } from '@/types';

interface SearchKeywordItemProps {
  keyword: SearchKeywordInfo;
}

const TIMING_LABELS: Record<SearchKeywordInfo['timing'], string> = {
  start: '開始時',
  round: 'ラウンド',
  summary: '統合前',
};

/**
 * 関連性スコアに応じた色を返す
 */
function getRelevanceColor(score: number, isFiltered: boolean): { bg: string; text: string; border: string } {
  if (isFiltered) {
    return { bg: 'bg-gray-800/50', text: 'text-gray-500', border: 'border-gray-700/50' };
  }
  if (score >= 0.8) {
    return { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-600/50' };
  } else if (score >= 0.6) {
    return { bg: 'bg-cyan-900/30', text: 'text-cyan-400', border: 'border-cyan-600/50' };
  } else {
    return { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-600/50' };
  }
}

/**
 * 関連性スコアのバッジを表示
 */
function RelevanceBadge({ score, reason, isExtracted, isFiltered }: {
  score: number;
  reason?: string;
  isExtracted?: boolean;
  isFiltered?: boolean;
}) {
  const percentage = Math.round(score * 100);

  if (isFiltered) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded text-xs font-medium border border-gray-600/50"
          title={reason || '関連性が低いため除外'}
        >
          関連性 {percentage}%
        </span>
        <span
          className="bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded text-xs border border-red-600/50"
          title="議論では使用されません"
        >
          除外
        </span>
      </div>
    );
  }

  const colors = getRelevanceColor(score, false);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`${colors.bg} ${colors.text} px-1.5 py-0.5 rounded text-xs font-medium border ${colors.border}`}
        title={reason || '関連性スコア'}
      >
        関連性 {percentage}%
      </span>
      {isExtracted && (
        <span
          className="bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded text-xs border border-purple-600/50"
          title="トピックに関連する部分のみ抽出済み"
        >
          抽出済
        </span>
      )}
    </div>
  );
}

/**
 * 検索結果をインライン表示するコンポーネント
 */
function InlineSearchResults({ results }: { results: SearchResult[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (results.length === 0) {
    return (
      <div className="mt-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-2">
        <div className="flex items-center gap-2 text-yellow-400/70 text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>検索結果が見つかりませんでした</span>
        </div>
      </div>
    );
  }

  const hasRelevanceInfo = results.some(r => r.relevance);
  const relevantCount = results.filter(r => !r.filtered).length;
  const filteredCount = results.filter(r => r.filtered).length;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-cyan-500 hover:text-cyan-300 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>検索結果を{isExpanded ? '折りたたむ' : '展開'}</span>
        <span className="text-gray-500">
          ({relevantCount}件
          {filteredCount > 0 && (
            <span className="text-orange-400">+{filteredCount}件除外</span>
          )}
          )
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-3 border-l-2 border-cyan-700/50 space-y-2">
          {hasRelevanceInfo && (
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
              <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>AIがトピックとの関連性を判定</span>
            </div>
          )}

          {results.map((result, index) => {
            const relevance = result.relevance;
            const isFiltered = result.filtered === true;
            const cardColors = relevance
              ? getRelevanceColor(relevance.score, isFiltered)
              : { bg: 'bg-cyan-900/20', text: '', border: 'border-cyan-700/30' };

            return (
              <div
                key={`${result.url}-${index}`}
                className={`${cardColors.bg} border ${cardColors.border} rounded-lg p-2 ${isFiltered ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-medium text-xs line-clamp-1 flex-1 ${
                      isFiltered
                        ? 'text-gray-400 hover:text-gray-300'
                        : 'text-cyan-400 hover:text-cyan-300'
                    }`}
                  >
                    {result.title}
                  </a>
                  {relevance && (
                    <RelevanceBadge
                      score={relevance.score}
                      reason={relevance.reason}
                      isExtracted={relevance.isExtracted}
                      isFiltered={isFiltered}
                    />
                  )}
                </div>
                <p className={`text-xs mt-1 line-clamp-2 ${isFiltered ? 'text-gray-500' : 'text-gray-400'}`}>
                  {result.content}
                </p>
                {relevance?.reason && (
                  <p className={`text-xs mt-1 italic ${isFiltered ? 'text-gray-600' : 'text-gray-500'}`}>
                    → {relevance.reason}
                  </p>
                )}
                <div className={`flex items-center gap-2 mt-1 text-xs ${isFiltered ? 'text-gray-600' : 'text-gray-500'}`}>
                  {result.engine && (
                    <span className="bg-gray-700/50 px-1.5 py-0.5 rounded">
                      {result.engine}
                    </span>
                  )}
                  {result.fullContent && !isFiltered && (
                    <span className="bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded" title="詳細コンテンツあり">
                      詳細あり
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
          <InlineSearchResults results={keyword.results} />
        )}
      </div>
    </div>
  );
}
