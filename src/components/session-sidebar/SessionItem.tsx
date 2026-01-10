'use client';

import { DiscussionSession } from '@/types';
import { formatDate } from '@/hooks/useSessionSidebar';

interface SessionItemProps {
  session: DiscussionSession;
  isSelected: boolean;
  isEditing: boolean;
  editTitle: string;
  isMenuOpen: boolean;
  disabled: boolean;
  isMultiSelectMode?: boolean;
  isChecked?: boolean;
  onSelect: () => void;
  onEditTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onToggleMenu: () => void;
  onToggleCheck?: () => void;
}

export function SessionItem({
  session,
  isSelected,
  isEditing,
  editTitle,
  isMenuOpen,
  disabled,
  isMultiSelectMode = false,
  isChecked = false,
  onSelect,
  onEditTitleChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onToggleMenu,
  onToggleCheck,
}: SessionItemProps) {
  return (
    <div
      className={`group relative mx-2 mb-1 rounded-lg transition-colors ${
        isSelected ? 'bg-gray-700' : 'hover:bg-gray-800'
      }`}
    >
      {isEditing ? (
        <div className="p-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            onBlur={onSaveEdit}
            className="w-full px-2 py-1 bg-gray-600 text-white text-sm rounded border border-gray-500 focus:outline-none focus:border-blue-500"
            aria-label="セッション名を編集"
            autoFocus
          />
        </div>
      ) : (
        <div className="flex items-start justify-between p-2">
          {/* 複数選択モード時のチェックボックス */}
          {isMultiSelectMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCheck?.();
              }}
              className="shrink-0 mr-2 mt-0.5"
              aria-label={isChecked ? 'セッションの選択を解除' : 'セッションを選択'}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  isChecked
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-500 hover:border-gray-400'
                }`}
              >
                {isChecked && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          )}

          <div
            className={`flex-1 min-w-0 pr-2 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={isMultiSelectMode ? onToggleCheck : onSelect}
          >
            <div className="flex items-center gap-1.5">
              <div className="text-sm text-white truncate flex-1" title={session.title}>
                {session.title}
              </div>
              {/* 状態マーク（現在アクティブなセッションで議論中の場合は非表示） */}
              {session.interruptedTurn && !(isSelected && disabled) && (
                <span
                  className={`shrink-0 px-1.5 py-0.5 text-[10px] rounded font-medium ${
                    session.interruptedTurn.summaryState === 'generating'
                      ? 'bg-purple-600/80 text-purple-100'
                      : session.interruptedTurn.summaryState === 'awaiting'
                        ? 'bg-blue-600/80 text-blue-100'
                        : 'bg-orange-600/80 text-orange-100'
                  }`}
                  title={
                    session.interruptedTurn.summaryState === 'generating'
                      ? `統合中: ${session.interruptedTurn.topic}`
                      : session.interruptedTurn.summaryState === 'awaiting'
                        ? `投票待ち: ${session.interruptedTurn.topic}`
                        : `中断中: ${session.interruptedTurn.topic}`
                  }
                >
                  {session.interruptedTurn.summaryState === 'generating'
                    ? '統合中'
                    : session.interruptedTurn.summaryState === 'awaiting'
                      ? '投票待ち'
                      : '中断中'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {session.turns.length}件の議論
              </span>
              <span className="text-xs text-gray-600">•</span>
              <span className="text-xs text-gray-500">
                {formatDate(session.updatedAt)}
              </span>
            </div>
          </div>

          {/* メニューボタン（複数選択モード時は非表示） */}
          {!isMultiSelectMode && (
            <button
              type="button"
              aria-label="セッションメニュー"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onToggleMenu();
              }}
              disabled={disabled}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-white rounded hover:bg-gray-600 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ドロップダウンメニュー */}
      {isMenuOpen && !disabled && (
        <div className="absolute right-2 top-8 z-10 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 min-w-[120px]">
          <button
            type="button"
            onClick={onStartEdit}
            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
          >
            名前を変更
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
