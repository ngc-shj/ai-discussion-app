'use client';

interface InterruptButtonProps {
  isInterrupting: boolean;
  onInterrupt: () => void;
}

export function InterruptButton({ isInterrupting, onInterrupt }: InterruptButtonProps) {
  return (
    <button
      type="button"
      onClick={onInterrupt}
      disabled={isInterrupting}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 shadow-sm ${
        isInterrupting
          ? 'bg-orange-600 text-white cursor-wait animate-pulse'
          : 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white hover:shadow-md active:scale-95'
      }`}
      title={isInterrupting ? '中断処理中...' : '議論を中断して後で再開できます'}
    >
      {isInterrupting ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>中断中...</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
          <span>中断</span>
        </>
      )}
    </button>
  );
}
