'use client';

import { DiscussionSession } from '@/types';
import { useSessionSidebar } from '@/hooks/useSessionSidebar';
import { SessionItem, SidebarHeader } from './session-sidebar';

interface SessionSidebarProps {
  sessions: DiscussionSession[];
  currentSessionId: string | null;
  onSelectSession: (session: DiscussionSession) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  disabled: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  disabled,
  isOpen = true,
  onClose,
  onCollapse,
}: SessionSidebarProps) {
  const {
    editingId,
    editTitle,
    menuOpenId,
    setEditTitle,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
    toggleMenu,
    closeMenu,
  } = useSessionSidebar({ onRenameSession, onDeleteSession });

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
          disabled={disabled}
          onNewSession={handleNewSessionClick}
          onClose={onClose}
          onCollapse={onCollapse}
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
                  onSelect={() => handleSelectSession(session)}
                  onEditTitleChange={setEditTitle}
                  onSaveEdit={() => handleSaveEdit(session.id)}
                  onCancelEdit={handleCancelEdit}
                  onStartEdit={() => handleStartEdit(session)}
                  onDelete={() => handleDelete(session.id)}
                  onToggleMenu={() => toggleMenu(session.id)}
                />
              ))}
            </div>
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
