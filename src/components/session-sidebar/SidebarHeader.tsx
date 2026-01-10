'use client';

interface SidebarHeaderProps {
  onNewSession: () => void;
  onClose?: () => void;
  onCollapse?: () => void;
  isMultiSelectMode?: boolean;
  selectedCount?: number;
  totalCount?: number;
  disabled?: boolean;
  onEnterMultiSelect?: () => void;
  onExitMultiSelect?: () => void;
  onSelectAll?: () => void;
  onBulkDelete?: () => void;
}

export function SidebarHeader({
  onNewSession,
  onClose,
  onCollapse,
  isMultiSelectMode = false,
  selectedCount = 0,
  totalCount = 0,
  disabled = false,
  onEnterMultiSelect,
  onExitMultiSelect,
  onSelectAll,
  onBulkDelete,
}: SidebarHeaderProps) {
  return (
    <div className="p-3 border-b border-gray-700 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          AI Discussion Arena
        </h1>
        {/* モバイル用閉じるボタン */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded"
            aria-label="メニューを閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* PC用折りたたみボタン */}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            aria-label="サイドバーを閉じる"
            title="サイドバーを閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>
      {isMultiSelectMode ? (
        /* 選択モード時のUI */
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">
              {selectedCount}件選択中
            </span>
            <div className="flex items-center gap-1">
              {selectedCount < totalCount && (
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                  全選択
                </button>
              )}
              <button
                type="button"
                onClick={onExitMultiSelect}
                className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onBulkDelete}
            disabled={selectedCount === 0}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              selectedCount > 0
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{selectedCount > 0 ? `${selectedCount}件を削除` : '削除'}</span>
          </button>
        </div>
      ) : (
        /* 通常モード時のUI */
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNewSession}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>新規議論</span>
          </button>
          {totalCount > 0 && (
            <button
              type="button"
              onClick={onEnterMultiSelect}
              disabled={disabled}
              className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                disabled
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
              }`}
              title="複数選択"
              aria-label="複数選択モードに切り替え"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
