'use client';

interface SidebarHeaderProps {
  disabled: boolean;
  onNewSession: () => void;
  onClose?: () => void;
  onCollapse?: () => void;
}

export function SidebarHeader({
  disabled,
  onNewSession,
  onClose,
  onCollapse,
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
      <button
        type="button"
        onClick={onNewSession}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>新規議論</span>
      </button>
    </div>
  );
}
