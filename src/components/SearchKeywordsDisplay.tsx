'use client';

import { useState } from 'react';
import { SearchKeywordInfo, SearchResult } from '@/types';
import { FullContentModal } from './FullContentModal';

interface SearchKeywordsDisplayProps {
  keywords: SearchKeywordInfo[];
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


// モーダル表示用の拡張型（どちらのコンテンツを表示するか）
type ModalState = (SearchResult & { _showOriginal?: boolean }) | null;

/**
 * 検索結果をインライン表示するコンポーネント
 */
function InlineSearchResults({ results }: { results: SearchResult[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullContentResult, setFullContentResult] = useState<ModalState>(null);

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
