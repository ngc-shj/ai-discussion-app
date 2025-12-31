'use client';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  onNewSession: () => void;
  onSettingsClick: () => void;
  disabled?: boolean;
}

export function MobileHeader({
  title,
  subtitle,
  onMenuClick,
  onNewSession,
  onSettingsClick,
  disabled,
}: MobileHeaderProps) {
  return (
    <header className="md:hidden flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900">
      {/* ハンバーガーメニュー */}
      <button
        type="button"
        onClick={onMenuClick}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="メニューを開く"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* タイトル */}
      <div className="flex-1 text-center min-w-0 px-2">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-400 truncate">{subtitle}</p>
        )}
      </div>

      {/* 右側ボタン群 */}
      <div className="flex items-center gap-1">
        {/* 新規議論ボタン */}
        <button
          type="button"
          onClick={onNewSession}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          aria-label="新規議論"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {/* 設定ボタン */}
        <button
          type="button"
          onClick={onSettingsClick}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="設定を開く"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
