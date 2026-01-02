'use client';

import { useState, useCallback } from 'react';
import { DiscussionSession } from '@/types';

export interface UseSessionSidebarProps {
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
}

export interface UseSessionSidebarReturn {
  // State
  editingId: string | null;
  editTitle: string;
  menuOpenId: string | null;

  // Actions
  setEditTitle: (title: string) => void;
  handleStartEdit: (session: DiscussionSession) => void;
  handleSaveEdit: (id: string) => void;
  handleCancelEdit: () => void;
  handleDelete: (id: string) => void;
  toggleMenu: (id: string) => void;
  closeMenu: () => void;
}

/**
 * 日付をフォーマット
 */
export function formatDate(date: Date): string {
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
}

export function useSessionSidebar({
  onRenameSession,
  onDeleteSession,
}: UseSessionSidebarProps): UseSessionSidebarReturn {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleStartEdit = useCallback((session: DiscussionSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  }, []);

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (editTitle.trim()) {
        onRenameSession(id, editTitle.trim());
      }
      setEditingId(null);
      setEditTitle('');
    },
    [editTitle, onRenameSession]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('このセッションを削除しますか？')) {
        onDeleteSession(id);
      }
      setMenuOpenId(null);
    },
    [onDeleteSession]
  );

  const toggleMenu = useCallback((id: string) => {
    setMenuOpenId((prev) => (prev === id ? null : id));
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpenId(null);
  }, []);

  return {
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
  };
}
