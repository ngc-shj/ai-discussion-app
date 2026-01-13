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
        {/* 参加AIパネルボタン */}
        <button
          type="button"
          onClick={onSettingsClick}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="参加AIパネルを開く"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
