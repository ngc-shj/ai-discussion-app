'use client';

interface ForkButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ForkButton({ onClick, disabled }: ForkButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm text-cyan-300 hover:text-white bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="このターンから議論を分岐"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>分岐</span>
    </button>
  );
}
