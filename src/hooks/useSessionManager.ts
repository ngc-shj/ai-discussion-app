'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DiscussionSession,
  DiscussionParticipant,
  InterruptedDiscussionState,
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

export interface SessionManagerState {
  sessions: DiscussionSession[];
  currentSession: DiscussionSession | null;
  interruptedState: InterruptedDiscussionState | null;
}

export interface SessionManagerActions {
  loadSessions: () => Promise<void>;
  selectSession: (session: DiscussionSession) => void;
  newSession: () => void;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newTitle: string) => Promise<void>;
  createSession: (title: string, participants: DiscussionParticipant[], rounds: number) => Promise<DiscussionSession>;
  updateSession: (session: DiscussionSession) => Promise<void>;
  setInterruptedState: (state: InterruptedDiscussionState | null) => void;
  discardInterrupted: () => void;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
}

export function useSessionManager(): SessionManagerState & SessionManagerActions {
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const [currentSession, setCurrentSession] = useState<DiscussionSession | null>(null);
  const [interruptedState, setInterruptedStateInternal] = useState<InterruptedDiscussionState | null>(null);

  // 最新のセッションを参照するためのref
  const currentSessionRef = useRef<DiscussionSession | null>(null);
  currentSessionRef.current = currentSession;

  // セッション一覧を読み込み
  const loadSessions = useCallback(async () => {
    try {
      const loadedSessions = await getAllSessions();
      setSessions(loadedSessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  // 初期ロード
  useEffect(() => {
    loadSessions();

    // 中断された議論があるかチェック
    const savedInterrupted = getInterruptedState();
    if (savedInterrupted) {
      setInterruptedStateInternal(savedInterrupted);
    }
  }, [loadSessions]);

  // 新しいセッションを開始
  const newSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  // セッションを選択
  const selectSession = useCallback((session: DiscussionSession) => {
    setCurrentSession(session);

    // セッションに中断状態がある場合
    if (session.interruptedTurn) {
      const turn = session.interruptedTurn;
      const interrupted: InterruptedDiscussionState = {
        sessionId: session.id,
        topic: turn.topic,
        participants: turn.participants || session.participants,
        messages: turn.messages,
        currentRound: turn.currentRound,
        currentParticipantIndex: turn.currentParticipantIndex,
        totalRounds: turn.totalRounds,
        searchResults: turn.searchResults,
        userProfile: turn.userProfile,
        discussionMode: turn.discussionMode,
        discussionDepth: turn.discussionDepth,
        directionGuide: turn.directionGuide,
        terminationConfig: turn.terminationConfig,
        interruptedAt: turn.interruptedAt,
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
  const setInterruptedState = useCallback((state: InterruptedDiscussionState | null) => {
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

  return {
    // State
    sessions,
    currentSession,
    interruptedState,
    // Actions
    loadSessions,
    selectSession,
    newSession,
    deleteSession,
    renameSession,
    createSession,
    updateSession,
    setInterruptedState,
    discardInterrupted,
    currentSessionRef,
  };
}
