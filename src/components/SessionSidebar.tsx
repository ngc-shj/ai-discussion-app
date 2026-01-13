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

        {/* 下部設定アイコン */}
        <div className="mt-auto border-t border-gray-700 p-3 relative">
          <button
            type="button"
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="flex-1 text-left truncate">設定</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
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
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>設定</span>
                </button>
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
