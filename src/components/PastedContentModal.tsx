'use client';

import { useEffect } from 'react';

interface PastedContentModalProps {
  text: string;
  onClose: () => void;
  /** ファイル名（指定時はタイトルに使用） */
  fileName?: string;
}

export function PastedContentModal({ text, onClose, fileName }: PastedContentModalProps) {
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

  const charCount = text.length;
  const lineCount = text.split('\n').length;
  const byteSize = new Blob([text]).size;
  const kbSize = (byteSize / 1024).toFixed(2);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-medium text-white">{fileName || '貼り付けられたコンテンツ'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700"
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
        <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">
          {kbSize} KB · {lineCount}行 · {charCount.toLocaleString()}文字
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono">
            {text}
          </pre>
        </div>
      </div>
    </div>
  );
}
