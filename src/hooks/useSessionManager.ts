'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DiscussionSession,
  DiscussionParticipant,
  InterruptedDiscussionSnapshot,
} from '@/types';
import {
  getAllSessions,
  saveSession,
  deleteSession as deleteSessionFromDB,
  updateSessionTitle,
  createNewSession,
  getInterruptedState,
  clearInterruptedState,
  saveInterruptedState,
} from '@/lib/session-storage';
import sessionEvent from '@/lib/session-event';

export interface UseSessionManagerState {
  sessions: DiscussionSession[];
  currentSession: DiscussionSession | null;
  interruptedState: InterruptedDiscussionSnapshot | null;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  isInitialLoadComplete: boolean;
}

export interface UseSessionManagerActions {
  // Low-level setters (for direct state manipulation in handlers)
  setSessions: React.Dispatch<React.SetStateAction<DiscussionSession[]>>;
  setCurrentSession: React.Dispatch<React.SetStateAction<DiscussionSession | null>>;
  setInterruptedState: (state: InterruptedDiscussionSnapshot | null) => void;
  // High-level actions
  loadSessions: () => Promise<DiscussionSession[]>;
  selectSession: (session: DiscussionSession) => void;
  newSession: () => void;
  deleteSession: (id: string) => Promise<void>;
  bulkDeleteSessions: (ids: string[]) => Promise<void>;
  renameSession: (id: string, newTitle: string) => Promise<void>;
  createSession: (title: string, participants: DiscussionParticipant[], rounds: number) => Promise<DiscussionSession>;
  updateSession: (session: DiscussionSession) => Promise<void>;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
  discardInterrupted: () => void;
}

export function useSessionManager(): UseSessionManagerState & UseSessionManagerActions {
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const [currentSession, setCurrentSession] = useState<DiscussionSession | null>(null);
  const [interruptedState, setInterruptedStateInternal] = useState<InterruptedDiscussionSnapshot | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // 最新のセッションを参照するためのref
  const currentSessionRef = useRef<DiscussionSession | null>(null);
  currentSessionRef.current = currentSession;

  // setCurrentSessionをラップして、refも同時に更新する
  const setCurrentSessionWithRef = useCallback((
    value: DiscussionSession | null | ((prev: DiscussionSession | null) => DiscussionSession | null)
  ) => {
    if (typeof value === 'function') {
      setCurrentSession((prev) => {
        const newValue = value(prev);
        currentSessionRef.current = newValue;
        return newValue;
      });
    } else {
      currentSessionRef.current = value;
      setCurrentSession(value);
    }
  }, []);

  // セッション一覧を読み込み
  const loadSessions = useCallback(async () => {
    try {
      const loadedSessions = await getAllSessions();
      setSessions(loadedSessions);
      return loadedSessions;
    } catch (err) {
      console.error('Failed to load sessions:', err);
      return [];
    }
  }, []);

  // 初期ロード
  useEffect(() => {
    const init = async () => {
      await loadSessions();
      setIsInitialLoadComplete(true);
    };
    init();
  }, [loadSessions]);

  // 新しいセッションを開始（セッションと中断状態をクリア）
  const newSession = useCallback(() => {
    // refも即座にクリア（非同期状態更新より先にrefをクリアしないと、新規議論開始時に古いセッションを参照してしまう）
    currentSessionRef.current = null;
    setCurrentSession(null);
    setInterruptedStateInternal(null);
    clearInterruptedState();
  }, []);

  // sessionResetイベントを購読してセッション状態をクリア
  useEffect(() => {
    const handler = () => {
      newSession();
    };
    sessionEvent.on('sessionReset', handler);
    return () => sessionEvent.off('sessionReset', handler);
  }, [newSession]);

  // discussionClearイベントを購読して中断状態のみクリア（セッションはそのまま）
  useEffect(() => {
    const handler = () => {
      setInterruptedStateInternal(null);
      clearInterruptedState();
    };
    sessionEvent.on('discussionClear', handler);
    return () => sessionEvent.off('discussionClear', handler);
  }, []);

  // セッションを選択
  const selectSession = useCallback((session: DiscussionSession) => {
    setCurrentSession(session);

    // セッションに中断状態がある場合
    if (session.interruptedTurn) {
      const turn = session.interruptedTurn;
      // 注意: InterruptedTurnState/InterruptedDiscussionSnapshot にフィールドを追加した場合、
      // ここと初期ロード処理の両方で対応するフィールドを追加すること
      const interrupted: InterruptedDiscussionSnapshot = {
        sessionId: session.id,
        topic: turn.topic,
        participants: turn.participants || session.participants,
        messages: turn.messages,
        currentRound: turn.currentRound,
        currentParticipantIndex: turn.currentParticipantIndex,
        totalRounds: turn.totalRounds,
        searchResults: turn.searchResults,
        searchKeywords: turn.searchKeywords,
        completedSearchKeywordIndex: turn.completedSearchKeywordIndex,
        searchConfig: turn.searchConfig,
        userProfile: turn.userProfile,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
        interruptedAt: turn.interruptedAt,
        summaryPhase: turn.summaryPhase,
        startMarker: turn.startMarker,
        extensionMarkers: turn.extensionMarkers,
      };
      setInterruptedStateInternal(interrupted);
    } else {
      setInterruptedStateInternal(null);
    }
  }, []);

  // セッションを削除
  const deleteSession = useCallback(async (id: string) => {
    try {
      await deleteSessionFromDB(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSession?.id === id) {
        newSession();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [currentSession, newSession]);

  // 複数セッションを一括削除
  const bulkDeleteSessions = useCallback(async (ids: string[]) => {
    try {
      // 並列で削除
      await Promise.all(ids.map(id => deleteSessionFromDB(id)));
      setSessions((prev) => prev.filter((s) => !ids.includes(s.id)));
      // 現在選択中のセッションが削除対象に含まれていれば新規セッション状態に
      if (currentSession && ids.includes(currentSession.id)) {
        newSession();
      }
    } catch (err) {
      console.error('Failed to bulk delete sessions:', err);
    }
  }, [currentSession, newSession]);

  // セッション名を変更
  const renameSession = useCallback(async (id: string, newTitle: string) => {
    try {
      await updateSessionTitle(id, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: new Date() } : s))
      );
      if (currentSession?.id === id) {
        setCurrentSession((prev) => prev ? { ...prev, title: newTitle } : null);
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  }, [currentSession]);

  // 新しいセッションを作成
  const createSession = useCallback(async (
    title: string,
    participants: DiscussionParticipant[],
    rounds: number
  ): Promise<DiscussionSession> => {
    const newSessionData = createNewSession(title, participants, rounds);
    await saveSession(newSessionData);
    setCurrentSession(newSessionData);
    setSessions((prev) => [newSessionData, ...prev]);
    return newSessionData;
  }, []);

  // セッションを更新
  const updateSession = useCallback(async (session: DiscussionSession) => {
    await saveSession(session);
    setCurrentSession(session);
    setSessions((prev) =>
      prev.map((s) => (s.id === session.id ? session : s))
    );
  }, []);

  // 中断状態を設定
  const setInterruptedState = useCallback((state: InterruptedDiscussionSnapshot | null) => {
    setInterruptedStateInternal(state);
    if (state) {
      saveInterruptedState(state);
    } else {
      clearInterruptedState();
    }
  }, []);

  // 中断状態を破棄
  const discardInterrupted = useCallback(() => {
    clearInterruptedState();
    setInterruptedStateInternal(null);
  }, []);

  // セッションを更新して保存（共通ヘルパー）
  const updateAndSaveSession = useCallback(async (
    updates: Partial<DiscussionSession>,
    options?: { async?: boolean }
  ) => {
    const latestSession = currentSessionRef.current;
    if (!latestSession) return;

    const updatedSession: DiscussionSession = {
      ...latestSession,
      ...updates,
      updatedAt: new Date(),
    };

    if (options?.async) {
      saveSession(updatedSession).catch(err => console.error('Failed to save session:', err));
    } else {
      await saveSession(updatedSession);
    }

    setCurrentSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  }, []);

  return {
    // State
    sessions,
    currentSession,
    interruptedState,
    currentSessionRef,
    isInitialLoadComplete,
    // Low-level setters
    setSessions,
    setCurrentSession: setCurrentSessionWithRef,
    setInterruptedState,
    // High-level actions
    loadSessions,
    selectSession,
    newSession,
    deleteSession,
    bulkDeleteSessions,
    renameSession,
    createSession,
    updateSession,
    updateAndSaveSession,
    discardInterrupted,
  };
}
