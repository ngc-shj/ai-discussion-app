'use client';

import { useState } from 'react';
import { SearchResult } from '@/types';
import { FullContentModal } from './FullContentModal';

interface SearchResultsDisplayProps {
  results: SearchResult[];
  filteredCount?: number;  // フィルタで除外された件数（後方互換用）
}

/**
 * 関連性スコアに応じた色を返す
 */
function getRelevanceColor(score: number, isFiltered: boolean): { bg: string; text: string; border: string } {
  if (isFiltered) {
    // 除外された結果はグレー系
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

// モーダル表示用の拡張型（どちらのコンテンツを表示するか）
type ModalState = (SearchResult & { _showOriginal?: boolean }) | null;

export function SearchResultsDisplay({ results }: SearchResultsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullContentResult, setFullContentResult] = useState<ModalState>(null);

  if (results.length === 0) return null;

  // 関連性でフィルタリングされた結果があるかチェック
  const hasRelevanceInfo = results.some(r => r.relevance);

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
        <div className="mt-2 pl-3 md:pl-4 pr-1 md:pr-2 border-l-2 border-cyan-700/50 space-y-2">
          {/* 関連性フィルタリングの説明 */}
          {hasRelevanceInfo && (
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>AIがトピックとの関連性を判定しました</span>
              {filteredCount > 0 && (
                <span className="text-orange-400">（グレー表示={filteredCount}件は議論で使用されません）</span>
              )}
            </div>
          )}

          {results.map((result, index) => {
            const relevance = result.relevance;
            const isFiltered = result.filtered === true;
            const cardColors = relevance
              ? getRelevanceColor(relevance.score, isFiltered)
              : { bg: 'bg-cyan-900/20', text: '', border: 'border-cyan-700/30' };
            const percentage = relevance ? Math.round(relevance.score * 100) : null;

            return (
              <div
                key={`${result.url}-${index}`}
                className={`${cardColors.bg} border ${cardColors.border} rounded-lg p-2 md:p-3 ${isFiltered ? 'opacity-60' : ''}`}
              >
                {/* タイトル */}
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium text-sm md:text-base line-clamp-1 block ${
                    isFiltered
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-cyan-400 hover:text-cyan-300'
                  }`}
                >
                  {result.title}
                </a>

                {/* スニペット */}
                <p className={`text-xs mt-1 line-clamp-2 ${isFiltered ? 'text-gray-500' : 'text-gray-400'}`}>
                  {result.content}
                </p>

                {/* AI評価理由（背景色＋左ボーダーで強調） */}
                {relevance?.reason && (
                  <div className={`mt-2 text-xs rounded-r pl-3 py-1.5 border-l-4 ${
                    isFiltered
                      ? 'bg-gray-800/50 border-gray-500 text-gray-400'
                      : 'bg-cyan-900/40 border-cyan-400 text-gray-200'
                  }`}>
                    <span className={`font-semibold ${isFiltered ? 'text-gray-300' : 'text-cyan-300'}`}>AI判定:</span>{' '}
                    {relevance.reason}
                  </div>
                )}

                {/* フッター: メタ情報 + バッジ */}
                <div className={`flex flex-wrap items-center gap-2 mt-2 text-xs ${isFiltered ? 'text-gray-600' : 'text-gray-500'}`}>
                  {result.engine && (
                    <span className="bg-gray-700/50 px-1.5 py-0.5 rounded">
                      {result.engine}
                    </span>
                  )}
                  {result.publishedDate && (
                    <span>{result.publishedDate}</span>
                  )}
                  {/* 関連性バッジ */}
                  {relevance && (
                    <span
                      className={`px-2 py-1 rounded font-bold text-xs border ${
                        isFiltered
                          ? 'bg-gray-700/70 text-gray-300 border-gray-500'
                          : `${cardColors.bg} ${cardColors.text} ${cardColors.border}`
                      }`}
                      title={relevance.reason || '関連性スコア'}
                    >
                      関連性 {percentage}%
                    </span>
                  )}
                  {/* 除外バッジ */}
                  {isFiltered && (
                    <span
                      className="bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded border border-red-600/50"
                      title="議論では使用されません"
                    >
                      除外
                    </span>
                  )}
                  {/* 全文取得済バッジ（クリックで全文表示） */}
                  {result.fullContent && !isFiltered && !relevance?.isExtracted && (
                    <button
                      type="button"
                      onClick={() => setFullContentResult({ ...result, _showOriginal: false })}
                      className="bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-800/60 hover:text-blue-300 transition-colors cursor-pointer"
                      title="クリックして全文を表示"
                    >
                      全文取得済
                    </button>
                  )}
                  {/* AI要約済みの場合: 全文取得済とAI要約済の2つのバッジを表示 */}
                  {relevance?.isExtracted && !isFiltered && result.originalFullContent && (
                    <button
                      type="button"
                      onClick={() => setFullContentResult({ ...result, _showOriginal: true })}
                      className="bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-800/60 hover:text-blue-300 transition-colors cursor-pointer"
                      title="クリックして元の全文を表示"
                    >
                      全文取得済
                    </button>
                  )}
                  {relevance?.isExtracted && !isFiltered && result.fullContent && (
                    <button
                      type="button"
                      onClick={() => setFullContentResult({ ...result, _showOriginal: false })}
                      className="bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded border border-purple-600/50 hover:bg-purple-800/40 hover:text-purple-300 transition-colors cursor-pointer"
                      title="クリックしてAI要約を表示"
                    >
                      AI要約済
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 全文/AI要約表示モーダル */}
      {fullContentResult && (fullContentResult.fullContent || fullContentResult.originalFullContent) && (
        <FullContentModal
          title={fullContentResult.title}
          url={fullContentResult.url}
          content={
            fullContentResult._showOriginal && fullContentResult.originalFullContent
              ? fullContentResult.originalFullContent
              : fullContentResult.fullContent || ''
          }
          isExtracted={!fullContentResult._showOriginal && fullContentResult.relevance?.isExtracted}
          onClose={() => setFullContentResult(null)}
        />
      )}
    </div>
  );
}
