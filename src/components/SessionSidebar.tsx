'use client';

import { useState } from 'react';
import { DiscussionSession } from '@/types';
import { useSessionSidebar } from '@/hooks/useSessionSidebar';
import { SessionItem, SidebarHeader } from './session-sidebar';

interface SessionSidebarProps {
  sessions: DiscussionSession[];
  currentSessionId: string | null;
  onSelectSession: (session: DiscussionSession) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onBulkDeleteSessions: (ids: string[]) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  disabled: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
  onOpenSettings?: () => void;
  onOpenPresets?: () => void;
  presetCount?: number;
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onBulkDeleteSessions,
  onRenameSession,
  disabled,
  isOpen = true,
  onClose,
  onCollapse,
  onOpenSettings,
  onOpenPresets,
  presetCount = 0,
}: SessionSidebarProps) {
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const {
    editingId,
    editTitle,
    menuOpenId,
    isMultiSelectMode,
    selectedSessionIds,
    setEditTitle,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
    toggleMenu,
    closeMenu,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleSessionSelection,
    selectAllSessions,
    handleBulkDelete,
  } = useSessionSidebar({ onRenameSession, onDeleteSession, onBulkDeleteSessions, sessions });

  const handleSelectSession = (session: DiscussionSession) => {
    if (!disabled) {
      onSelectSession(session);
      onClose?.();
    }
  };

  const handleNewSessionClick = () => {
    onNewSession();
    onClose?.();
  };

  // オーバーレイモードで閉じている場合は何も描画しない
  if (onClose && !isOpen) {
    return null;
  }

  return (
    <>
      {/* モバイル用オーバーレイ背景 */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`
          ${onClose ? 'fixed z-50' : 'relative'}
          w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full
        `}
      >
        <SidebarHeader
          onNewSession={handleNewSessionClick}
          onClose={onClose}
          onCollapse={onCollapse}
          isMultiSelectMode={isMultiSelectMode}
          selectedCount={selectedSessionIds.size}
          totalCount={sessions.length}
          disabled={disabled}
          onEnterMultiSelect={enterMultiSelectMode}
          onExitMultiSelect={exitMultiSelectMode}
          onSelectAll={selectAllSessions}
          onBulkDelete={handleBulkDelete}
        />

        {/* セッション一覧 */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              議論履歴がありません
            </div>
          ) : (
            <div className="py-2">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isSelected={currentSessionId === session.id}
                  isEditing={editingId === session.id}
                  editTitle={editTitle}
                  isMenuOpen={menuOpenId === session.id}
                  disabled={disabled}
                  isMultiSelectMode={isMultiSelectMode}
                  isChecked={selectedSessionIds.has(session.id)}
                  onSelect={() => handleSelectSession(session)}
                  onEditTitleChange={setEditTitle}
                  onSaveEdit={() => handleSaveEdit(session.id)}
                  onCancelEdit={handleCancelEdit}
                  onStartEdit={() => handleStartEdit(session)}
                  onDelete={() => handleDelete(session.id)}
                  onToggleMenu={() => toggleMenu(session.id)}
                  onToggleCheck={() => toggleSessionSelection(session.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 下部メニュー */}
        <div className="mt-auto border-t border-gray-700 p-3 relative">
          <button
            type="button"
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="flex-1 text-left truncate">メニュー</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSettingsMenuOpen ? "M19 15l-7-7-7 7" : "M5 9l7 7 7-7"} />
            </svg>
          </button>

          {/* 設定ポップアップメニュー */}
          {isSettingsMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsSettingsMenuOpen(false)}
              />
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors border-b border-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>設定</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    onOpenPresets?.();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors border-b border-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="flex-1 text-left">議論テンプレート</span>
                  {presetCount > 0 && (
                    <span className="text-xs text-indigo-400">{presetCount}</span>
                  )}
                </button>
                <a
                  href="https://github.com/ngc-shj/ai-discussion-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsSettingsMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span>GitHub</span>
                  <svg className="w-3.5 h-3.5 ml-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </>
          )}
        </div>

        {/* クリックで外を閉じる */}
        {menuOpenId && (
          <div
            className="fixed inset-0 z-0"
            onClick={closeMenu}
          />
        )}
      </div>
    </>
  );
}
