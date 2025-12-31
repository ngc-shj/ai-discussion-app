'use client';

import { useState } from 'react';
import { DiscussionSession } from '@/types';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleStartEdit = (session: DiscussionSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (id: string) => {
    if (confirm('このセッションを削除しますか？')) {
      onDeleteSession(id);
    }
    setMenuOpenId(null);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今日';
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    }
  };

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
        {/* ヘッダー: タイトルと新規議論ボタン */}
        <div className="p-3 border-b border-gray-700 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              AI Discussion Arena
            </h1>
            {/* モバイル用閉じるボタン */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white rounded"
                aria-label="メニューを閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* PC用折りたたみボタン */}
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                aria-label="サイドバーを閉じる"
                title="サイドバーを閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewSessionClick}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>新規議論</span>
          </button>
        </div>

        {/* セッション一覧 */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              議論履歴がありません
            </div>
          ) : (
            <div className="py-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative mx-2 mb-1 rounded-lg transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-gray-700'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  {editingId === session.id ? (
                    <div className="p-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(session.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onBlur={() => handleSaveEdit(session.id)}
                        className="w-full px-2 py-1 bg-gray-600 text-white text-sm rounded border border-gray-500 focus:outline-none focus:border-blue-500"
                        aria-label="セッション名を編集"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-start justify-between p-2">
                      <div
                        className={`flex-1 min-w-0 pr-2 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                        onClick={() => handleSelectSession(session)}
                      >
                        <div className="text-sm text-white truncate" title={session.title}>
                          {session.title}
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

                      {/* メニューボタン */}
                      <button
                        type="button"
                        aria-label="セッションメニュー"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === session.id ? null : session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-white rounded hover:bg-gray-600"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* ドロップダウンメニュー */}
                  {menuOpenId === session.id && (
                    <div className="absolute right-2 top-8 z-10 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(session)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                      >
                        名前を変更
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(session.id)}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* クリックで外を閉じる */}
        {menuOpenId && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setMenuOpenId(null)}
          />
        )}
      </div>
    </>
  );
}
