'use client';

interface CounterargumentButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function CounterargumentButton({ onClick, disabled, isLoading }: CounterargumentButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm text-orange-300 hover:text-white bg-orange-900/50 hover:bg-orange-800/50 border border-orange-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="この結論に対する反論を生成"
    >
      {isLoading ? (
        <div className="animate-spin w-4 h-4 border-2 border-orange-300 border-t-transparent rounded-full" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
      <span>{isLoading ? '生成中...' : '反論を生成'}</span>
    </button>
  );
}
