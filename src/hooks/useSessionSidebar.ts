'use client';

import { useState, useCallback } from 'react';
import { DiscussionSession } from '@/types';

export interface UseSessionSidebarProps {
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onBulkDeleteSessions?: (ids: string[]) => void;
  sessions?: DiscussionSession[];
}

export interface UseSessionSidebarReturn {
  // State
  editingId: string | null;
  editTitle: string;
  menuOpenId: string | null;
  isMultiSelectMode: boolean;
  selectedSessionIds: Set<string>;

  // Actions
  setEditTitle: (title: string) => void;
  handleStartEdit: (session: DiscussionSession) => void;
  handleSaveEdit: (id: string) => void;
  handleCancelEdit: () => void;
  handleDelete: (id: string) => void;
  toggleMenu: (id: string) => void;
  closeMenu: () => void;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;
  toggleSessionSelection: (id: string) => void;
  selectAllSessions: () => void;
  handleBulkDelete: () => void;
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
  onBulkDeleteSessions,
  sessions = [],
}: UseSessionSidebarProps): UseSessionSidebarReturn {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

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

  // 複数選択モードを開始
  const enterMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(true);
    setSelectedSessionIds(new Set());
    setMenuOpenId(null);
  }, []);

  // 複数選択モードを終了
  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedSessionIds(new Set());
  }, []);

  // セッションの選択をトグル
  const toggleSessionSelection = useCallback((id: string) => {
    setSelectedSessionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 全セッションを選択
  const selectAllSessions = useCallback(() => {
    setSelectedSessionIds(new Set(sessions.map((s) => s.id)));
  }, [sessions]);

  // 選択したセッションを一括削除
  const handleBulkDelete = useCallback(() => {
    if (selectedSessionIds.size === 0) return;

    const count = selectedSessionIds.size;
    if (confirm(`${count}件のセッションを削除しますか？`)) {
      onBulkDeleteSessions?.(Array.from(selectedSessionIds));
      exitMultiSelectMode();
    }
  }, [selectedSessionIds, onBulkDeleteSessions, exitMultiSelectMode]);

  return {
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
  };
}
