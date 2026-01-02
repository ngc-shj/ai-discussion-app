'use client';

import { useState, useCallback, useRef } from 'react';
import {
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSession,
  SearchResult,
  MessageVote,
  FollowUpQuestion,
  InterruptedDiscussionState,
  InterruptedTurnState,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  SearchConfig,
} from '@/types';
import {
  getAllSessions,
  saveSession,
  createNewSession,
  createNewTurn,
  saveInterruptedState,
  clearInterruptedState,
} from '@/lib/session-storage';
import {
  processSSEStream,
  SSEEventHandlers,
  createInterruptedState,
  getPreviousTurns,
} from '@/lib/sse-utils';

export interface ProgressState {
  currentRound: number;
  totalRounds: number;
  currentParticipantIndex: number;
  totalParticipants: number;
  currentParticipant: DiscussionParticipant | null;
  isSummarizing: boolean;
}

export interface DiscussionState {
  // 現在のターン状態
  currentMessages: DiscussionMessage[];
  currentFinalAnswer: string;
  currentSummaryPrompt: string;
  currentTopic: string;
  currentSearchResults: SearchResult[];
  // ローディング状態
  isLoading: boolean;
  isSearching: boolean;
  isGeneratingFollowUps: boolean;
  isGeneratingSummary: boolean;
  awaitingSummary: boolean;
  // 進捗状態
  progress: ProgressState;
  completedParticipants: Set<string>;
  // フォローアップ
  suggestedFollowUps: FollowUpQuestion[];
  // エラー
  error: string | null;
  // 投票
  messageVotes: MessageVote[];
}

export interface DiscussionActions {
  // 状態セッター
  setCurrentMessages: React.Dispatch<React.SetStateAction<DiscussionMessage[]>>;
  setCurrentFinalAnswer: React.Dispatch<React.SetStateAction<string>>;
  setCurrentTopic: React.Dispatch<React.SetStateAction<string>>;
  setCurrentSearchResults: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setMessageVotes: React.Dispatch<React.SetStateAction<MessageVote[]>>;
  // アクション
  handleVote: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  clearCurrentTurnState: () => void;
  handleInterrupt: () => void;
  startDiscussion: (params: StartDiscussionParams) => Promise<void>;
  resumeDiscussion: (params: ResumeDiscussionParams) => Promise<void>;
  generateSummary: (params: GenerateSummaryParams) => Promise<void>;
}

export interface StartDiscussionParams {
  topic: string;
  participants: DiscussionParticipant[];
  terminationConfig: TerminationConfig;
  searchConfig: SearchConfig;
  userProfile: UserProfile;
  discussionMode: DiscussionMode;
  discussionDepth: DiscussionDepth;
  directionGuide: DirectionGuide;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setCurrentSession: React.Dispatch<React.SetStateAction<DiscussionSession | null>>;
  setSessions: React.Dispatch<React.SetStateAction<DiscussionSession[]>>;
  setInterruptedState: (state: InterruptedDiscussionState | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

export interface ResumeDiscussionParams {
  interruptedState: InterruptedDiscussionState;
  restoreFromSession: (session: {
    participants: DiscussionParticipant[];
    discussionMode?: DiscussionMode;
    discussionDepth?: DiscussionDepth;
    directionGuide?: DirectionGuide;
    terminationConfig?: TerminationConfig;
    userProfile?: UserProfile;
  }) => void;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setCurrentSession: React.Dispatch<React.SetStateAction<DiscussionSession | null>>;
  setSessions: React.Dispatch<React.SetStateAction<DiscussionSession[]>>;
  setInterruptedState: (state: InterruptedDiscussionState | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

export interface GenerateSummaryParams {
  participants: DiscussionParticipant[];
  userProfile: UserProfile;
  discussionMode: DiscussionMode;
  discussionDepth: DiscussionDepth;
  directionGuide: DirectionGuide;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setInterruptedState: (state: InterruptedDiscussionState | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

const INITIAL_PROGRESS: ProgressState = {
  currentRound: 0,
  totalRounds: 0,
  currentParticipantIndex: 0,
  totalParticipants: 0,
  currentParticipant: null,
  isSummarizing: false,
};

export function useDiscussion(): DiscussionState & DiscussionActions {
  // 現在のターン状態
  const [currentMessages, setCurrentMessages] = useState<DiscussionMessage[]>([]);
  const [currentFinalAnswer, setCurrentFinalAnswer] = useState<string>('');
  const [currentSummaryPrompt, setCurrentSummaryPrompt] = useState<string>('');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);

  // ローディング状態
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [awaitingSummary, setAwaitingSummary] = useState(false);

  // 進捗状態
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [completedParticipants, setCompletedParticipants] = useState<Set<string>>(new Set());

  // フォローアップ
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<FollowUpQuestion[]>([]);

  // エラー
  const [error, setError] = useState<string | null>(null);

  // 投票
  const [messageVotes, setMessageVotes] = useState<MessageVote[]>([]);

  // 中断リクエストフラグ
  const interruptRequestedRef = useRef(false);

  // 投票を追加/更新
  const handleVote = useCallback((messageId: string, vote: 'agree' | 'disagree' | 'neutral') => {
    setMessageVotes((prev: MessageVote[]) => {
      const existing = prev.findIndex(v => v.messageId === messageId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { messageId, vote, timestamp: new Date() };
        return updated;
      }
      return [...prev, { messageId, vote, timestamp: new Date() }];
    });
  }, []);

  // 現在のターン状態をクリア
  const clearCurrentTurnState = useCallback(() => {
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentSummaryPrompt('');
    setCurrentTopic('');
    setCurrentSearchResults([]);
    setError(null);
    setSuggestedFollowUps([]);
    setIsGeneratingFollowUps(false);
    setAwaitingSummary(false);
    setIsGeneratingSummary(false);
  }, []);

  // 議論を中断
  const handleInterrupt = useCallback(() => {
    interruptRequestedRef.current = true;
  }, []);

  // 統合回答を生成
  const generateSummary = useCallback(async (params: GenerateSummaryParams) => {
    if (currentMessages.length === 0) return;

    const {
      participants,
      userProfile,
      discussionMode,
      discussionDepth,
      directionGuide,
      currentSessionRef,
      setInterruptedState,
      updateAndSaveSession,
    } = params;

    setIsGeneratingSummary(true);
    setAwaitingSummary(false);
    setError(null);

    const previousTurns = getPreviousTurns(currentSessionRef.current);
    let collectedFinalAnswer = '';
    let collectedSummaryPrompt = '';

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentTopic,
          participants,
          messages: currentMessages,
          previousTurns,
          searchResults: currentSearchResults,
          userProfile,
          discussionMode,
          discussionDepth,
          directionGuide,
          messageVotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const handlers: SSEEventHandlers = {
        onProgress: (progressData) => {
          if (progressData.isSummarizing) {
            setProgress((prev) => ({ ...prev, isSummarizing: true }));
          }
        },
        onSummary: (finalAnswer, summaryPrompt) => {
          collectedFinalAnswer = finalAnswer;
          collectedSummaryPrompt = summaryPrompt || '';
          setCurrentFinalAnswer(finalAnswer);
          setCurrentSummaryPrompt(summaryPrompt || '');
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(true);
        },
        onFollowups: (followups) => {
          setSuggestedFollowUps(followups);
          setIsGeneratingFollowUps(false);
        },
        onError: (errorMsg) => {
          console.error('Summary error:', errorMsg);
          setError(errorMsg);
        },
        onComplete: () => {
          setIsGeneratingSummary(false);
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(false);
        },
      };

      await processSSEStream(response, handlers);

      if (collectedFinalAnswer) {
        const newTurn = createNewTurn(
          currentTopic,
          currentMessages,
          collectedFinalAnswer,
          currentSearchResults.length > 0 ? currentSearchResults : undefined,
          collectedSummaryPrompt || undefined
        );
        const latestSession = currentSessionRef.current;

        if (latestSession) {
          await updateAndSaveSession({
            turns: [...latestSession.turns, newTurn],
            interruptedTurn: undefined,
          });
        }

        clearInterruptedState();
        setInterruptedState(null);
        clearCurrentTurnState();
        setMessageVotes([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [currentMessages, currentTopic, currentSearchResults, messageVotes, clearCurrentTurnState]);

  // 議論を開始
  const startDiscussion = useCallback(async (params: StartDiscussionParams) => {
    const {
      topic,
      participants,
      terminationConfig,
      searchConfig,
      userProfile,
      discussionMode,
      discussionDepth,
      directionGuide,
      currentSessionRef,
      setCurrentSession,
      setSessions,
      setInterruptedState,
      updateAndSaveSession,
    } = params;

    if (participants.length === 0) {
      setError('少なくとも1つのAIモデルを選択してください');
      return;
    }

    // 状態をクリアする前に、直前のターン情報を保存
    const prevTopic = currentTopic;
    const prevFinalAnswer = currentFinalAnswer;

    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentSummaryPrompt('');
    setCurrentSearchResults([]);
    setSuggestedFollowUps([]);
    setIsGeneratingFollowUps(false);
    setError(null);
    setIsLoading(true);
    setCurrentTopic(topic);
    setCompletedParticipants(new Set());
    interruptRequestedRef.current = false;
    setProgress({
      currentRound: 1,
      totalRounds: terminationConfig.maxRounds,
      currentParticipantIndex: 0,
      totalParticipants: participants.length,
      currentParticipant: participants[0],
      isSummarizing: false,
    });

    // 検索が有効な場合
    let searchResults: SearchResult[] = [];
    if (searchConfig.enabled) {
      setIsSearching(true);
      try {
        const searchQuery = searchConfig.query || topic;
        const searchResponse = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            type: searchConfig.searchType,
            limit: searchConfig.maxResults,
            language: searchConfig.language || 'ja',
          }),
        });
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          searchResults = searchData.results || [];
          setCurrentSearchResults(searchResults);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }

    // 過去のターンを取得
    let sessionAtStart = currentSessionRef.current;
    const previousTurns = getPreviousTurns(sessionAtStart);

    if (prevTopic && prevFinalAnswer) {
      previousTurns.push({ topic: prevTopic, finalAnswer: prevFinalAnswer });
    }

    // 新規セッションの場合
    if (!sessionAtStart) {
      const newSession = createNewSession(
        topic.slice(0, 50) + (topic.length > 50 ? '...' : ''),
        participants,
        terminationConfig.maxRounds
      );
      await saveSession(newSession);
      setCurrentSession(newSession);
      setSessions((prev) => [newSession, ...prev]);
      sessionAtStart = newSession;
    }

    let collectedMessages: DiscussionMessage[] = [];
    let collectedFinalAnswer = '';
    let collectedSummaryPrompt = '';
    let currentProgressState = { currentRound: 1, currentParticipantIndex: 0 };

    try {
      const response = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          participants,
          rounds: terminationConfig.maxRounds,
          previousTurns,
          searchResults,
          userProfile,
          discussionMode,
          discussionDepth,
          directionGuide,
          terminationConfig,
          messageVotes,
          skipSummary: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start discussion');
      }

      const handlers: SSEEventHandlers = {
        onProgress: (progressData) => {
          currentProgressState = {
            currentRound: progressData.currentRound,
            currentParticipantIndex: progressData.currentParticipantIndex,
          };
          setProgress({
            currentRound: progressData.currentRound,
            totalRounds: progressData.totalRounds,
            currentParticipantIndex: progressData.currentParticipantIndex,
            totalParticipants: progressData.totalParticipants,
            currentParticipant: progressData.currentParticipant,
            isSummarizing: progressData.isSummarizing,
          });
        },
        onMessage: (message) => {
          collectedMessages = [...collectedMessages, message];
          setCurrentMessages(collectedMessages);
          setCompletedParticipants((prev) => {
            const newSet = new Set(prev);
            newSet.add(`${message.provider}-${message.model}`);
            return newSet;
          });
          // 自動保存
          const latestSession = currentSessionRef.current;
          if (latestSession) {
            const interruptedTurn: InterruptedTurnState = {
              topic,
              participants,
              messages: collectedMessages,
              currentRound: currentProgressState.currentRound,
              currentParticipantIndex: currentProgressState.currentParticipantIndex,
              totalRounds: terminationConfig.maxRounds,
              searchResults: searchResults.length > 0 ? searchResults : undefined,
              userProfile,
              discussionMode,
              discussionDepth,
              directionGuide,
              terminationConfig,
              interruptedAt: new Date(),
            };
            const updatedSession: DiscussionSession = {
              ...latestSession,
              interruptedTurn,
              updatedAt: new Date(),
            };
            saveSession(updatedSession).catch((err) =>
              console.error('Failed to save interrupted state:', err)
            );
            setSessions((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            );
          }
        },
        onSummary: (finalAnswer, summaryPrompt) => {
          collectedFinalAnswer = finalAnswer;
          collectedSummaryPrompt = summaryPrompt || '';
          setCurrentFinalAnswer(finalAnswer);
          setCurrentSummaryPrompt(summaryPrompt || '');
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(true);
        },
        onFollowups: (followups) => {
          setSuggestedFollowUps(followups);
          setIsGeneratingFollowUps(false);
        },
        onError: (errorMsg) => {
          console.error('Discussion error:', errorMsg);
          if (
            errorMsg.includes('No messages were generated') ||
            errorMsg.includes('Failed to generate summary with all')
          ) {
            setError(errorMsg);
          }
        },
        onReadyForSummary: () => {
          setAwaitingSummary(true);
          setIsLoading(false);
          // 中断状態をクリア
          const latestSession = currentSessionRef.current;
          if (latestSession) {
            const updatedSession: DiscussionSession = {
              ...latestSession,
              interruptedTurn: undefined,
              updatedAt: new Date(),
            };
            saveSession(updatedSession).catch((err) =>
              console.error('Failed to clear interrupted state:', err)
            );
            setCurrentSession(updatedSession);
            setSessions((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            );
          }
        },
        onComplete: () => {
          setIsLoading(false);
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(false);
        },
      };

      const wasInterrupted = await processSSEStream(
        response,
        handlers,
        () => interruptRequestedRef.current
      );

      if (wasInterrupted) {
        const interrupted = createInterruptedState({
          sessionId: sessionAtStart?.id || '',
          topic,
          participants,
          messages: collectedMessages,
          currentRound: currentProgressState.currentRound,
          currentParticipantIndex: currentProgressState.currentParticipantIndex,
          totalRounds: terminationConfig.maxRounds,
          searchResults: searchResults.length > 0 ? searchResults : undefined,
          userProfile,
          discussionMode,
          discussionDepth,
          directionGuide,
          terminationConfig,
        });
        saveInterruptedState(interrupted);
        setInterruptedState(interrupted);
        setIsLoading(false);
        return;
      }

      if (collectedFinalAnswer) {
        const newTurn = createNewTurn(
          topic,
          collectedMessages,
          collectedFinalAnswer,
          searchResults.length > 0 ? searchResults : undefined,
          collectedSummaryPrompt || undefined
        );
        const latestSession = currentSessionRef.current;

        if (latestSession) {
          await updateAndSaveSession({
            turns: [...latestSession.turns, newTurn],
            interruptedTurn: undefined,
          });
        }
        clearInterruptedState();
        setInterruptedState(null);
        clearCurrentTurnState();
        setSuggestedFollowUps([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [currentTopic, currentFinalAnswer, messageVotes, clearCurrentTurnState]);

  // 中断した議論を再開
  const resumeDiscussion = useCallback(async (params: ResumeDiscussionParams) => {
    const {
      interruptedState,
      restoreFromSession,
      currentSessionRef,
      setCurrentSession,
      setSessions,
      setInterruptedState,
      updateAndSaveSession,
    } = params;

    // 中断状態をクリア
    clearInterruptedState();
    setInterruptedState(null);

    // 設定を復元
    restoreFromSession({
      participants: interruptedState.participants,
      discussionMode: interruptedState.discussionMode,
      discussionDepth: interruptedState.discussionDepth,
      directionGuide: interruptedState.directionGuide,
      terminationConfig: interruptedState.terminationConfig,
      userProfile: interruptedState.userProfile,
    });

    // セッションを復元
    const session = await getAllSessions().then((sessions) =>
      sessions.find((s) => s.id === interruptedState.sessionId)
    );
    if (session) {
      const updatedSession: DiscussionSession = {
        ...session,
        interruptedTurn: undefined,
      };
      await saveSession(updatedSession);
      setCurrentSession(updatedSession);
      setSessions((prev) =>
        prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
      );
    }

    // 中断時のメッセージを復元
    setCurrentTopic(interruptedState.topic);
    setCurrentMessages(interruptedState.messages);
    setCurrentSearchResults(interruptedState.searchResults || []);

    setIsLoading(true);
    setError(null);
    interruptRequestedRef.current = false;
    setCompletedParticipants(new Set());
    setProgress({
      currentRound: interruptedState.currentRound,
      totalRounds: interruptedState.totalRounds,
      currentParticipantIndex: interruptedState.currentParticipantIndex,
      totalParticipants: interruptedState.participants.length,
      currentParticipant: interruptedState.participants[interruptedState.currentParticipantIndex],
      isSummarizing: false,
    });

    const previousTurns = getPreviousTurns(session || currentSessionRef.current);
    let collectedMessages: DiscussionMessage[] = [...interruptedState.messages];
    let collectedFinalAnswer = '';
    let collectedSummaryPrompt = '';
    let currentProgressState = {
      currentRound: interruptedState.currentRound,
      currentParticipantIndex: interruptedState.currentParticipantIndex,
    };
    const resumeSession = currentSessionRef.current;

    try {
      const response = await fetch('/api/discuss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: interruptedState.topic,
          participants: interruptedState.participants,
          rounds: interruptedState.totalRounds,
          previousTurns,
          searchResults: interruptedState.searchResults,
          userProfile: interruptedState.userProfile,
          discussionMode: interruptedState.discussionMode,
          discussionDepth: interruptedState.discussionDepth,
          directionGuide: interruptedState.directionGuide,
          terminationConfig: interruptedState.terminationConfig,
          messageVotes,
          resumeFrom: {
            messages: interruptedState.messages,
            currentRound: interruptedState.currentRound,
            currentParticipantIndex: interruptedState.currentParticipantIndex,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume discussion');
      }

      const handlers: SSEEventHandlers = {
        onProgress: (progressData) => {
          currentProgressState = {
            currentRound: progressData.currentRound,
            currentParticipantIndex: progressData.currentParticipantIndex,
          };
          setProgress({
            currentRound: progressData.currentRound,
            totalRounds: progressData.totalRounds,
            currentParticipantIndex: progressData.currentParticipantIndex,
            totalParticipants: progressData.totalParticipants,
            currentParticipant: progressData.currentParticipant,
            isSummarizing: progressData.isSummarizing,
          });
        },
        onMessage: (message) => {
          collectedMessages = [...collectedMessages, message];
          setCurrentMessages(collectedMessages);
          setCompletedParticipants((prev) => {
            const newSet = new Set(prev);
            newSet.add(`${message.provider}-${message.model}`);
            return newSet;
          });
          // 自動保存
          const latestSession = currentSessionRef.current;
          if (latestSession) {
            const interruptedTurn: InterruptedTurnState = {
              topic: interruptedState.topic,
              participants: interruptedState.participants,
              messages: collectedMessages,
              currentRound: currentProgressState.currentRound,
              currentParticipantIndex: currentProgressState.currentParticipantIndex,
              totalRounds: interruptedState.totalRounds,
              searchResults: interruptedState.searchResults,
              userProfile: interruptedState.userProfile,
              discussionMode: interruptedState.discussionMode,
              discussionDepth: interruptedState.discussionDepth,
              directionGuide: interruptedState.directionGuide,
              terminationConfig: interruptedState.terminationConfig,
              interruptedAt: new Date(),
            };
            const updatedSession: DiscussionSession = {
              ...latestSession,
              interruptedTurn,
              updatedAt: new Date(),
            };
            saveSession(updatedSession).catch((err) =>
              console.error('Failed to save interrupted state:', err)
            );
            setSessions((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            );
          }
        },
        onSummary: (finalAnswer, summaryPrompt) => {
          collectedFinalAnswer = finalAnswer;
          collectedSummaryPrompt = summaryPrompt || '';
          setCurrentFinalAnswer(finalAnswer);
          setCurrentSummaryPrompt(summaryPrompt || '');
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
          setIsGeneratingFollowUps(true);
        },
        onFollowups: (followups) => {
          setSuggestedFollowUps(followups);
          setIsGeneratingFollowUps(false);
        },
        onError: (errorMsg) => {
          console.error('Discussion error:', errorMsg);
          if (
            errorMsg.includes('No messages were generated') ||
            errorMsg.includes('Failed to generate summary with all')
          ) {
            setError(errorMsg);
          }
        },
        onComplete: () => {
          setIsLoading(false);
          setProgress((prev) => ({ ...prev, isSummarizing: false }));
        },
      };

      const wasInterrupted = await processSSEStream(
        response,
        handlers,
        () => interruptRequestedRef.current
      );

      if (wasInterrupted) {
        const newInterruptedState = createInterruptedState({
          sessionId: resumeSession?.id || '',
          topic: interruptedState.topic,
          participants: interruptedState.participants,
          messages: collectedMessages,
          currentRound: currentProgressState.currentRound,
          currentParticipantIndex: currentProgressState.currentParticipantIndex,
          totalRounds: interruptedState.totalRounds,
          searchResults: interruptedState.searchResults,
          userProfile: interruptedState.userProfile,
          discussionMode: interruptedState.discussionMode,
          discussionDepth: interruptedState.discussionDepth,
          directionGuide: interruptedState.directionGuide,
          terminationConfig: interruptedState.terminationConfig,
        });
        saveInterruptedState(newInterruptedState);
        setInterruptedState(newInterruptedState);
        setIsLoading(false);
        return;
      }

      if (collectedFinalAnswer) {
        const newTurn = createNewTurn(
          interruptedState.topic,
          collectedMessages,
          collectedFinalAnswer,
          interruptedState.searchResults,
          collectedSummaryPrompt || undefined
        );
        const latestSession = currentSessionRef.current;

        if (latestSession) {
          await updateAndSaveSession({
            turns: [...latestSession.turns, newTurn],
            interruptedTurn: undefined,
          });
        }

        clearCurrentTurnState();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [messageVotes, clearCurrentTurnState]);

  return {
    // State
    currentMessages,
    currentFinalAnswer,
    currentSummaryPrompt,
    currentTopic,
    currentSearchResults,
    isLoading,
    isSearching,
    isGeneratingFollowUps,
    isGeneratingSummary,
    awaitingSummary,
    progress,
    completedParticipants,
    suggestedFollowUps,
    error,
    messageVotes,
    // Actions
    setCurrentMessages,
    setCurrentFinalAnswer,
    setCurrentTopic,
    setCurrentSearchResults,
    setError,
    setMessageVotes,
    handleVote,
    clearCurrentTurnState,
    handleInterrupt,
    startDiscussion,
    resumeDiscussion,
    generateSummary,
  };
}
