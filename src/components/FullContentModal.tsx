'use client';

import { useEffect } from 'react';

interface FullContentModalProps {
  title: string;
  url: string;
  content: string;  // 表示するコンテンツ（全文またはAI要約）
  isExtracted?: boolean;  // AI要約済みかどうか
  onClose: () => void;
}

export function FullContentModal({
  title,
  url,
  content,
  isExtracted,
  onClose,
}: FullContentModalProps) {
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

  const charCount = content.length;
  const lineCount = content.split('\n').length;
  const byteSize = new Blob([content]).size;
  const kbSize = (byteSize / 1024).toFixed(2);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
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
            title="閉じる"
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

        {/* メタ情報 */}
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

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
