'use client';

import { useState } from 'react';
import { SearchResult } from '@/types';
import { FullContentModal } from './FullContentModal';

// モーダル表示用の拡張型（どちらのコンテンツを表示するか）
type ModalState = (SearchResult & { _showOriginal?: boolean }) | null;

/**
 * 関連性スコアに応じた色を返す
 */
export function getRelevanceColor(score: number, isFiltered: boolean): { bg: string; text: string; border: string } {
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

interface InlineSearchResultsProps {
  results: SearchResult[];
  /** 初期状態で展開するか（trueの場合、展開ボタンを非表示にして常に展開状態） */
  defaultExpanded?: boolean;
  /** APIから取得した総件数（重複含む） */
  fetchedCount?: number;
}

/**
 * 検索結果をインライン表示するコンポーネント
 */
export function InlineSearchResults({ results, defaultExpanded = false, fetchedCount }: InlineSearchResultsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [fullContentResult, setFullContentResult] = useState<ModalState>(null);

  // defaultExpandedがtrueの場合は展開ボタンを表示しない
  const showToggleButton = !defaultExpanded;

  // 重複件数を計算（fetchedCountがある場合のみ）
  const uniqueCount = results.length;
  const duplicateCount = fetchedCount !== undefined ? fetchedCount - uniqueCount : 0;

  if (results.length === 0) {
    // 取得はしたが全て重複だった場合
    if (fetchedCount !== undefined && fetchedCount > 0) {
      return (
        <div className="mt-2 bg-gray-800/50 border border-gray-700/30 rounded-lg p-2">
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>取得{fetchedCount}件 → 全て重複のため0件追加</span>
          </div>
        </div>
      );
    }
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
    <div className={showToggleButton ? 'mt-2' : ''}>
      {showToggleButton && (
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
            (有効<span className="text-cyan-400">{relevantCount}件</span>
            {fetchedCount !== undefined && (
              <span className="text-gray-500">: 取得{fetchedCount}</span>
            )}
            {duplicateCount > 0 && (
              <span className="text-gray-500">、重複{duplicateCount}</span>
            )}
            {filteredCount > 0 && (
              <span className="text-orange-400">、除外{filteredCount}</span>
            )}
            )
          </span>
        </button>
      )}

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
            const percentage = relevance ? Math.round(relevance.score * 100) : null;

            return (
              <div
                key={`${result.url}-${index}`}
                className={`${cardColors.bg} border ${cardColors.border} rounded-lg p-2 ${isFiltered ? 'opacity-60' : ''}`}
              >
                {/* タイトル */}
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium text-xs line-clamp-1 block ${
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
                  {/* AI要約済みだが元の全文がない場合 */}
                  {relevance?.isExtracted && !isFiltered && !result.originalFullContent && (
                    <span
                      className="bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded text-xs"
                      title="全文取得できませんでした"
                    >
                      全文なし
                    </span>
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
