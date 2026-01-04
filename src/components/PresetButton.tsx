'use client';

interface PresetButtonProps {
  onClick: () => void;
  presetCount: number;
  disabled?: boolean;
}

export function PresetButton({ onClick, presetCount, disabled }: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="設定プリセットを管理"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      プリセット
      {presetCount > 0 && (
        <span className="px-1.5 py-0.5 bg-indigo-900/50 rounded-full text-[10px]">
          {presetCount}
        </span>
      )}
    </button>
  );
}
