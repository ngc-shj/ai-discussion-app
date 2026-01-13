'use client';

import { useState } from 'react';
import { PastedContentModal } from './PastedContentModal';

export type AttachmentSource = 'pasted' | 'file';

interface AttachedTextChipProps {
  text: string;
  onRemove?: () => void;
  disabled?: boolean;
  /** 読み取り専用モード（削除ボタン非表示、モーダル表示は可能） */
  readOnly?: boolean;
  /** 添付元（pasted: 貼り付け、file: ファイル） */
  source?: AttachmentSource;
  /** ファイル名（sourceがfileの場合に表示） */
  fileName?: string;
}

export function AttachedTextChip({
  text,
  onRemove,
  disabled,
  readOnly,
  source = 'pasted',
  fileName,
}: AttachedTextChipProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ファイルの場合はファイル名、それ以外はプレビュー
  const displayText = source === 'file' && fileName
    ? fileName
    : text.slice(0, 30).replace(/\n/g, ' ') + (text.length > 30 ? '...' : '');

  // 拡張子からファイルタイプを取得
  const getFileType = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      'txt': 'TXT',
      'md': 'MD',
      'json': 'JSON',
      'js': 'JS',
      'ts': 'TS',
      'tsx': 'TSX',
      'jsx': 'JSX',
      'css': 'CSS',
      'html': 'HTML',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'py': 'PY',
      'rb': 'RB',
      'go': 'GO',
      'rs': 'RS',
      'java': 'JAVA',
      'c': 'C',
      'cpp': 'C++',
      'h': 'H',
      'sh': 'SH',
      'sql': 'SQL',
      'csv': 'CSV',
    };
    return typeMap[ext] || ext.toUpperCase() || 'FILE';
  };

  const badgeText = source === 'file' && fileName
    ? getFileType(fileName)
    : 'PASTED';

  // アイコン（ファイル or クリップボード）
  const Icon = source === 'file' ? (
    <svg
      className="w-4 h-4 text-gray-400 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4 text-gray-400 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );

  return (
    <>
      <div
        className={`relative flex flex-col bg-gray-700 border border-gray-600 rounded-lg w-[100px] h-[80px] overflow-hidden ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        {/* 削除ボタン（readOnlyモードでは非表示） */}
        {!readOnly && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="absolute top-0.5 right-0.5 p-0.5 text-gray-300 hover:text-red-400 transition-colors disabled:cursor-not-allowed z-10 bg-gray-800 rounded-full border border-gray-500"
            title="削除"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* メインコンテンツ（クリックでモーダル表示） */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex-1 flex flex-col p-2 text-left hover:bg-gray-600/50 transition-colors cursor-pointer"
        >
          {/* アイコンとプレビュー */}
          <div className="flex items-start gap-1.5 flex-1 min-h-0">
            <div className="shrink-0 mt-0.5">{Icon}</div>
            <span className="text-[10px] text-gray-300 line-clamp-3 leading-tight break-all">
              {displayText}
            </span>
          </div>

          {/* バッジ（下部） */}
          <div className="mt-auto pt-1">
            <span className="text-[10px] text-gray-200 bg-gray-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-medium">
              {badgeText}
            </span>
          </div>
        </button>
      </div>

      {/* モーダルダイアログ */}
      {isModalOpen && (
        <PastedContentModal
          text={text}
          onClose={() => setIsModalOpen(false)}
          fileName={fileName}
        />
      )}
    </>
  );
}
