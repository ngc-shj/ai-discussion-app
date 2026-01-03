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
  SummaryState,
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
}

export interface StreamingMessage {
  messageId: string;
  participantId: string; // 参加者への参照
  content: string;
  provider: string;
  model?: string;
  round: number;
}

export interface DiscussionState {
  currentMessages: DiscussionMessage[];
  currentFinalAnswer: string;
  currentSummaryPrompt: string;
  currentTopic: string;
  currentSearchResults: SearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  isGeneratingFollowUps: boolean;
  summaryState: SummaryState;
  progress: ProgressState;
  completedParticipants: Set<string>;
  suggestedFollowUps: FollowUpQuestion[];
  error: string | null;
  messageVotes: MessageVote[];
  discussionParticipants: DiscussionParticipant[];
  streamingMessage: StreamingMessage | null;
}

export interface RestoreDiscussionStateParams {
  topic: string;
  messages: DiscussionMessage[];
  searchResults?: SearchResult[];
  summaryState?: SummaryState;
}

export interface DiscussionActions {
  setCurrentMessages: React.Dispatch<React.SetStateAction<DiscussionMessage[]>>;
  setCurrentFinalAnswer: React.Dispatch<React.SetStateAction<string>>;
  setCurrentTopic: React.Dispatch<React.SetStateAction<string>>;
  setCurrentSearchResults: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setMessageVotes: React.Dispatch<React.SetStateAction<MessageVote[]>>;
  handleVote: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  clearCurrentTurnState: () => void;
  restoreDiscussionState: (params: RestoreDiscussionStateParams) => void;
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
};

// ============================================
// 共通のディスカッションコンテキスト型
// ============================================
interface DiscussionContext {
  topic: string;
  participants: DiscussionParticipant[];
  totalRounds: number;
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
}

// ============================================
// 共通のSSEハンドラー作成パラメータ
// ============================================
interface CreateSSEHandlersParams {
  context: DiscussionContext;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setSessions: React.Dispatch<React.SetStateAction<DiscussionSession[]>>;
  setCurrentSession?: React.Dispatch<React.SetStateAction<DiscussionSession | null>>;
  setProgress: React.Dispatch<React.SetStateAction<ProgressState>>;
  setCurrentMessages: React.Dispatch<React.SetStateAction<DiscussionMessage[]>>;
  setCompletedParticipants: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCurrentFinalAnswer: React.Dispatch<React.SetStateAction<string>>;
  setCurrentSummaryPrompt: React.Dispatch<React.SetStateAction<string>>;
  setSuggestedFollowUps: React.Dispatch<React.SetStateAction<FollowUpQuestion[]>>;
  setIsGeneratingFollowUps: React.Dispatch<React.SetStateAction<boolean>>;
  setSummaryState?: React.Dispatch<React.SetStateAction<SummaryState>>;
  setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setStreamingMessage?: React.Dispatch<React.SetStateAction<StreamingMessage | null>>;
  collectedMessagesRef: { current: DiscussionMessage[] };
  collectedFinalAnswerRef: { current: string };
  collectedSummaryPromptRef: { current: string };
  currentProgressStateRef: { current: { currentRound: number; currentParticipantIndex: number } };
  includeReadyForSummary?: boolean;
}

function createDiscussionSSEHandlers(params: CreateSSEHandlersParams): SSEEventHandlers {
  const {
    context,
    currentSessionRef,
    setSessions,
    setCurrentSession,
    setProgress,
    setCurrentMessages,
    setCompletedParticipants,
    setCurrentFinalAnswer,
    setCurrentSummaryPrompt,
    setSuggestedFollowUps,
    setIsGeneratingFollowUps,
    setSummaryState,
    setIsLoading,
    setError,
    setStreamingMessage,
    collectedMessagesRef,
    collectedFinalAnswerRef,
    collectedSummaryPromptRef,
    currentProgressStateRef,
    includeReadyForSummary = false,
  } = params;

  return {
    onProgress: (progressData) => {
      currentProgressStateRef.current = {
        currentRound: progressData.currentRound,
        currentParticipantIndex: progressData.currentParticipantIndex,
      };
      setProgress({
        currentRound: progressData.currentRound,
        totalRounds: progressData.totalRounds,
        currentParticipantIndex: progressData.currentParticipantIndex,
        totalParticipants: progressData.totalParticipants,
        currentParticipant: progressData.currentParticipant,
      });
    },
    onMessage: (message) => {
      setStreamingMessage?.(null);
      collectedMessagesRef.current = [...collectedMessagesRef.current, message];
      setCurrentMessages(collectedMessagesRef.current);
      setCompletedParticipants((prev) => {
        const newSet = new Set(prev);
        newSet.add(`${message.provider}-${message.model}`);
        return newSet;
      });
      // 自動保存
      // 次に発言すべきAIの位置を計算
      const currentRound = currentProgressStateRef.current.currentRound;
      const currentPIndex = currentProgressStateRef.current.currentParticipantIndex;
      const totalParticipants = context.participants.length;

      // 次の位置を計算（ラウンド内で最後の参加者なら次のラウンドへ）
      let nextRound = currentRound;
      let nextParticipantIndex = currentPIndex + 1;
      let isAllComplete = false;
      if (nextParticipantIndex >= totalParticipants) {
        nextRound = currentRound + 1;
        nextParticipantIndex = 0;
        // 全ラウンド完了したかチェック
        if (nextRound > context.totalRounds) {
          isAllComplete = true;
          // 範囲外にならないよう調整
          nextRound = context.totalRounds;
          nextParticipantIndex = totalParticipants - 1;
        }
      }

      const latestSession = currentSessionRef.current;
      if (latestSession) {
        const interruptedTurn: InterruptedTurnState = {
          topic: context.topic,
          participants: context.participants,
          messages: collectedMessagesRef.current,
          currentRound: nextRound,
          currentParticipantIndex: nextParticipantIndex,
          totalRounds: context.totalRounds,
          searchResults: context.searchResults,
          userProfile: context.userProfile,
          discussionMode: context.discussionMode,
          discussionDepth: context.discussionDepth,
          directionGuide: context.directionGuide,
          terminationConfig: context.terminationConfig,
          interruptedAt: new Date(),
          summaryState: isAllComplete ? 'awaiting' : 'idle',
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
    onMessageChunk: (messageId, _chunk, accumulatedContent, provider, model, round) => {
      // 現在の参加者IDを取得
      const currentParticipantIndex = currentProgressStateRef.current.currentParticipantIndex;
      const currentParticipant = context.participants[currentParticipantIndex];
      const participantId = currentParticipant?.id || '';

      setStreamingMessage?.({ messageId, participantId, content: accumulatedContent, provider, model, round });
    },
    onSummary: (finalAnswer, summaryPrompt) => {
      collectedFinalAnswerRef.current = finalAnswer;
      collectedSummaryPromptRef.current = summaryPrompt || '';
      setCurrentFinalAnswer(finalAnswer);
      setCurrentSummaryPrompt(summaryPrompt || '');
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
    onReadyForSummary: includeReadyForSummary
      ? () => {
          setSummaryState?.('awaiting');
          setIsLoading?.(false);
          const latestSession = currentSessionRef.current;
          if (latestSession) {
            // summaryState: 'awaiting'状態を保持した中断状態を保存
            const interruptedTurn: InterruptedTurnState = {
              topic: context.topic,
              participants: context.participants,
              messages: collectedMessagesRef.current,
              currentRound: currentProgressStateRef.current.currentRound,
              currentParticipantIndex: currentProgressStateRef.current.currentParticipantIndex,
              totalRounds: context.totalRounds,
              searchResults: context.searchResults,
              interruptedAt: new Date(),
              summaryState: 'awaiting',
            };
            const updatedSession: DiscussionSession = {
              ...latestSession,
              interruptedTurn,
              updatedAt: new Date(),
            };
            saveSession(updatedSession).catch((err) =>
              console.error('Failed to save awaiting summary state:', err)
            );
            setCurrentSession?.(updatedSession);
            setSessions((prev) =>
              prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
            );
          }
        }
      : undefined,
    onComplete: () => {
      setIsLoading?.(false);
      setIsGeneratingFollowUps(false);
    },
  };
}

// ============================================
// useDiscussion フック
// ============================================
export function useDiscussion(): DiscussionState & DiscussionActions {
  const [currentMessages, setCurrentMessages] = useState<DiscussionMessage[]>([]);
  const [currentFinalAnswer, setCurrentFinalAnswer] = useState<string>('');
  const [currentSummaryPrompt, setCurrentSummaryPrompt] = useState<string>('');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  const [summaryState, setSummaryState] = useState<SummaryState>('idle');
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS);
  const [completedParticipants, setCompletedParticipants] = useState<Set<string>>(new Set());
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<FollowUpQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messageVotes, setMessageVotes] = useState<MessageVote[]>([]);
  const [discussionParticipants, setDiscussionParticipants] = useState<DiscussionParticipant[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);

  const interruptRequestedRef = useRef(false);

  const handleVote = useCallback((messageId: string, vote: 'agree' | 'disagree' | 'neutral') => {
    setMessageVotes((prev: MessageVote[]) => {
      const existing = prev.findIndex((v) => v.messageId === messageId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { messageId, vote, timestamp: new Date() };
        return updated;
      }
      return [...prev, { messageId, vote, timestamp: new Date() }];
    });
  }, []);

  const clearCurrentTurnState = useCallback(() => {
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentSummaryPrompt('');
    setCurrentTopic('');
    setCurrentSearchResults([]);
    setError(null);
    setSuggestedFollowUps([]);
    setIsGeneratingFollowUps(false);
    setSummaryState('idle');
  }, []);

  const restoreDiscussionState = useCallback((params: RestoreDiscussionStateParams) => {
    setCurrentTopic(params.topic);
    setCurrentMessages(params.messages);
    setCurrentSearchResults(params.searchResults || []);
    setSummaryState(params.summaryState || 'idle');
    setCurrentFinalAnswer('');
    setCurrentSummaryPrompt('');
    setError(null);
    setSuggestedFollowUps([]);
    setIsGeneratingFollowUps(false);
  }, []);

  const handleInterrupt = useCallback(() => {
    interruptRequestedRef.current = true;
  }, []);

  // 統合回答を生成
  const generateSummary = useCallback(
    async (params: GenerateSummaryParams) => {
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

      setSummaryState('generating');
      setError(null);
      // 復元・破棄ボタンをすぐに非表示にする
      setInterruptedState(null);

      // セッションのinterruptedTurnを統合回答生成中状態に更新
      // クリアするのではなく、summaryState: 'generating'で更新することでリロード時に復元可能にする
      if (currentSessionRef.current?.interruptedTurn) {
        await updateAndSaveSession({
          interruptedTurn: {
            ...currentSessionRef.current.interruptedTurn,
            summaryState: 'generating',
            interruptedAt: new Date(),
          },
        });
      }

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
          onProgress: () => {
            // Progress is tracked via summaryState
          },
          onSummary: (finalAnswer, summaryPrompt) => {
            collectedFinalAnswer = finalAnswer;
            collectedSummaryPrompt = summaryPrompt || '';
            setCurrentFinalAnswer(finalAnswer);
            setCurrentSummaryPrompt(summaryPrompt || '');
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
            setSummaryState('idle');
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
        setSummaryState('idle');
      }
    },
    [currentMessages, currentTopic, currentSearchResults, messageVotes, clearCurrentTurnState]
  );

  // 議論を開始
  const startDiscussion = useCallback(
    async (params: StartDiscussionParams) => {
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
      setDiscussionParticipants(participants);
      setCompletedParticipants(new Set());
      interruptRequestedRef.current = false;
      setProgress({
        currentRound: 1,
        totalRounds: terminationConfig.maxRounds,
        currentParticipantIndex: 0,
        totalParticipants: participants.length,
        currentParticipant: participants[0],
      });

      // 検索
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

      let sessionAtStart = currentSessionRef.current;
      const previousTurns = getPreviousTurns(sessionAtStart);

      if (prevTopic && prevFinalAnswer) {
        previousTurns.push({ topic: prevTopic, finalAnswer: prevFinalAnswer });
      }

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

      // 収集用のref
      const collectedMessagesRef = { current: [] as DiscussionMessage[] };
      const collectedFinalAnswerRef = { current: '' };
      const collectedSummaryPromptRef = { current: '' };
      const currentProgressStateRef = { current: { currentRound: 1, currentParticipantIndex: 0 } };

      const context: DiscussionContext = {
        topic,
        participants,
        totalRounds: terminationConfig.maxRounds,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide,
        terminationConfig,
      };

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

        const handlers = createDiscussionSSEHandlers({
          context,
          currentSessionRef,
          setSessions,
          setCurrentSession,
          setProgress,
          setCurrentMessages,
          setCompletedParticipants,
          setCurrentFinalAnswer,
          setCurrentSummaryPrompt,
          setSuggestedFollowUps,
          setIsGeneratingFollowUps,
          setSummaryState,
          setIsLoading,
          setError,
          setStreamingMessage,
          collectedMessagesRef,
          collectedFinalAnswerRef,
          collectedSummaryPromptRef,
          currentProgressStateRef,
          includeReadyForSummary: true,
        });

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
            messages: collectedMessagesRef.current,
            currentRound: currentProgressStateRef.current.currentRound,
            currentParticipantIndex: currentProgressStateRef.current.currentParticipantIndex,
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

        if (collectedFinalAnswerRef.current) {
          const newTurn = createNewTurn(
            topic,
            collectedMessagesRef.current,
            collectedFinalAnswerRef.current,
            searchResults.length > 0 ? searchResults : undefined,
            collectedSummaryPromptRef.current || undefined
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
    },
    [currentTopic, currentFinalAnswer, messageVotes, clearCurrentTurnState]
  );

  // 中断した議論を再開
  const resumeDiscussion = useCallback(
    async (params: ResumeDiscussionParams) => {
      const {
        interruptedState,
        restoreFromSession,
        currentSessionRef,
        setCurrentSession,
        setSessions,
        setInterruptedState,
        updateAndSaveSession,
      } = params;

      clearInterruptedState();
      setInterruptedState(null);

      restoreFromSession({
        participants: interruptedState.participants,
        discussionMode: interruptedState.discussionMode,
        discussionDepth: interruptedState.discussionDepth,
        directionGuide: interruptedState.directionGuide,
        terminationConfig: interruptedState.terminationConfig,
        userProfile: interruptedState.userProfile,
      });

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

      setCurrentTopic(interruptedState.topic);
      setCurrentMessages(interruptedState.messages);
      setCurrentSearchResults(interruptedState.searchResults || []);
      setDiscussionParticipants(interruptedState.participants);
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
      });

      const previousTurns = getPreviousTurns(session || currentSessionRef.current);
      const resumeSession = currentSessionRef.current;

      // 収集用のref
      const collectedMessagesRef = { current: [...interruptedState.messages] };
      const collectedFinalAnswerRef = { current: '' };
      const collectedSummaryPromptRef = { current: '' };
      const currentProgressStateRef = {
        current: {
          currentRound: interruptedState.currentRound,
          currentParticipantIndex: interruptedState.currentParticipantIndex,
        },
      };

      const context: DiscussionContext = {
        topic: interruptedState.topic,
        participants: interruptedState.participants,
        totalRounds: interruptedState.totalRounds,
        searchResults: interruptedState.searchResults,
        userProfile: interruptedState.userProfile,
        discussionMode: interruptedState.discussionMode,
        discussionDepth: interruptedState.discussionDepth,
        directionGuide: interruptedState.directionGuide,
        terminationConfig: interruptedState.terminationConfig,
      };

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
            skipSummary: true,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to resume discussion');
        }

        const handlers = createDiscussionSSEHandlers({
          context,
          currentSessionRef,
          setSessions,
          setCurrentSession,
          setProgress,
          setCurrentMessages,
          setCompletedParticipants,
          setCurrentFinalAnswer,
          setCurrentSummaryPrompt,
          setSuggestedFollowUps,
          setIsGeneratingFollowUps,
          setSummaryState,
          setIsLoading,
          setError,
          setStreamingMessage,
          collectedMessagesRef,
          collectedFinalAnswerRef,
          collectedSummaryPromptRef,
          currentProgressStateRef,
          includeReadyForSummary: true,
        });

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
            messages: collectedMessagesRef.current,
            currentRound: currentProgressStateRef.current.currentRound,
            currentParticipantIndex: currentProgressStateRef.current.currentParticipantIndex,
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

        if (collectedFinalAnswerRef.current) {
          const newTurn = createNewTurn(
            interruptedState.topic,
            collectedMessagesRef.current,
            collectedFinalAnswerRef.current,
            interruptedState.searchResults,
            collectedSummaryPromptRef.current || undefined
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
    },
    [messageVotes, clearCurrentTurnState]
  );

  return {
    currentMessages,
    currentFinalAnswer,
    currentSummaryPrompt,
    currentTopic,
    currentSearchResults,
    isLoading,
    isSearching,
    isGeneratingFollowUps,
    summaryState,
    progress,
    completedParticipants,
    suggestedFollowUps,
    error,
    messageVotes,
    discussionParticipants,
    streamingMessage,
    setCurrentMessages,
    setCurrentFinalAnswer,
    setCurrentTopic,
    setCurrentSearchResults,
    setError,
    setMessageVotes,
    handleVote,
    clearCurrentTurnState,
    restoreDiscussionState,
    handleInterrupt,
    startDiscussion,
    resumeDiscussion,
    generateSummary,
  };
}
