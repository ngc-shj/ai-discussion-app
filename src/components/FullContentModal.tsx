'use client';

import { useEffect, useState, useMemo } from 'react';

interface FullContentModalProps {
  title: string;
  url: string;
  content: string;  // AI要約済みの場合は要約内容、そうでなければ全文
  originalFullContent?: string;  // AI要約前の元の全文
  isExtracted?: boolean;  // AI要約済みかどうか
  onClose: () => void;
}

type TabType = 'summary' | 'fullContent';

export function FullContentModal({
  title,
  url,
  content,
  originalFullContent,
  isExtracted,
  onClose,
}: FullContentModalProps) {
  // タブ状態（AI要約済みで元の全文がある場合のみタブ表示）
  const hasBothContents = isExtracted && originalFullContent;
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 表示するコンテンツ
  const displayContent = useMemo(() => {
    if (hasBothContents && activeTab === 'fullContent') {
      return originalFullContent;
    }
    return content;
  }, [hasBothContents, activeTab, originalFullContent, content]);

  const charCount = displayContent.length;
  const lineCount = displayContent.split('\n').length;
  const byteSize = new Blob([displayContent]).size;
  const kbSize = (byteSize / 1024).toFixed(2);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-medium text-white truncate">{title}</h2>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 truncate block"
            >
              {url}
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* タブ切り替え（両方ある場合のみ表示） */}
        {hasBothContents ? (
          <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              AI要約
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fullContent')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'fullContent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              元の全文
            </button>
            <span className="text-xs text-gray-500 ml-2">
              {kbSize} KB · {lineCount}行 · {charCount.toLocaleString()}文字
            </span>
          </div>
        ) : (
          /* メタ情報（タブがない場合） */
          <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700 flex items-center gap-2">
            {isExtracted ? (
              <span className="bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded text-xs border border-purple-600/50">
                AI要約済
              </span>
            ) : (
              <span className="bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded text-xs">
                全文取得済
              </span>
            )}
            <span>{kbSize} KB · {lineCount}行 · {charCount.toLocaleString()}文字</span>
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
            {displayContent}
          </div>
        </div>
      </div>
    </div>
  );
}
