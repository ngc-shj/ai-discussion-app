'use client';

import { useState, useCallback, useRef } from 'react';
import {
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSession,
  SearchResult,
  SearchKeywordInfo,
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
  ExtendDiscussionConfig,
  StartMarker,
  ExtensionMarker,
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
  currentSearchKeywords: SearchKeywordInfo[];
  isLoading: boolean;
  isSearching: boolean;
  isGeneratingFollowUps: boolean;
  isProcessing: boolean;
  summaryState: SummaryState;
  progress: ProgressState;
  completedParticipants: Set<string>;
  suggestedFollowUps: FollowUpQuestion[];
  error: string | null;
  messageVotes: MessageVote[];
  discussionParticipants: DiscussionParticipant[];
  streamingMessage: StreamingMessage | null;
  startMarker: StartMarker | null;
  extensionMarkers: ExtensionMarker[];
  // 現在の議論で使用中の設定（延長時に参照）
  currentDiscussionMode: DiscussionMode | null;
  currentDiscussionDepth: DiscussionDepth | null;
  currentDirectionGuide: DirectionGuide | null;
  currentTerminationConfig: TerminationConfig | null;
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
  setCurrentSearchKeywords: React.Dispatch<React.SetStateAction<SearchKeywordInfo[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setMessageVotes: React.Dispatch<React.SetStateAction<MessageVote[]>>;
  handleVote: (messageId: string, vote: 'agree' | 'disagree' | 'neutral') => void;
  clearCurrentTurnState: () => void;
  restoreDiscussionState: (params: RestoreDiscussionStateParams) => void;
  handleInterrupt: () => void;
  startDiscussion: (params: StartDiscussionParams) => Promise<void>;
  resumeDiscussion: (params: ResumeDiscussionParams) => Promise<void>;
  extendDiscussion: (params: ExtendDiscussionParams) => Promise<void>;
  generateSummary: (params: GenerateSummaryParams) => Promise<void>;
  generateFollowUps: (params: GenerateFollowUpsParams) => Promise<void>;
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
  searchConfig: SearchConfig;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setInterruptedState: (state: InterruptedDiscussionState | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

export interface GenerateFollowUpsParams {
  turnId: string;
  topic: string;
  finalAnswer: string;
  participants: DiscussionParticipant[];
  userProfile: UserProfile;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

export interface ExtendDiscussionParams {
  config: ExtendDiscussionConfig;
  participants: DiscussionParticipant[];
  searchConfig: SearchConfig;
  userProfile: UserProfile;
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setCurrentSession: React.Dispatch<React.SetStateAction<DiscussionSession | null>>;
  setSessions: React.Dispatch<React.SetStateAction<DiscussionSession[]>>;
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
  startMarker?: StartMarker;
  extensionMarkers?: ExtensionMarker[];
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
  setIsSearching?: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentSearchResults?: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  setCurrentSearchKeywords?: React.Dispatch<React.SetStateAction<SearchKeywordInfo[]>>;
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
    setIsSearching,
    setCurrentSearchResults,
    setCurrentSearchKeywords,
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
          startMarker: context.startMarker,
          extensionMarkers: context.extensionMarkers,
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
              startMarker: context.startMarker,
              extensionMarkers: context.extensionMarkers,
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
      // 注意: ここでsummaryStateを'idle'にしない
      // startDiscussionの場合: onReadyForSummaryで'awaiting'に設定されるので、それを維持する
      // generateSummaryの場合: onSummaryで'idle'に設定されるので、ここでは不要
    },
    onSearching: () => {
      setIsSearching?.(true);
    },
    onSearchResults: (searchResults) => {
      setIsSearching?.(false);
      setCurrentSearchResults?.(searchResults);
    },
    onSearchKeywords: (searchKeywords) => {
      setCurrentSearchKeywords?.(prev => [...prev, searchKeywords]);
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
  const [startMarker, setStartMarker] = useState<StartMarker | null>(null);
  const [extensionMarkers, setExtensionMarkers] = useState<ExtensionMarker[]>([]);
  const [currentSearchKeywords, setCurrentSearchKeywords] = useState<SearchKeywordInfo[]>([]);
  // 現在の議論で使用中の設定（延長時に参照するため）
  const [currentDiscussionMode, setCurrentDiscussionMode] = useState<DiscussionMode | null>(null);
  const [currentDiscussionDepth, setCurrentDiscussionDepth] = useState<DiscussionDepth | null>(null);
  const [currentDirectionGuide, setCurrentDirectionGuide] = useState<DirectionGuide | null>(null);
  const [currentTerminationConfig, setCurrentTerminationConfig] = useState<TerminationConfig | null>(null);

  const interruptRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    setCurrentSearchKeywords([]);
    setError(null);
    // suggestedFollowUpsはクリアしない（次のアクション用に保持する必要がある）
    // 新しい議論開始時やセッション切り替え時に個別にクリアする
    setIsGeneratingFollowUps(false);
    setSummaryState('idle');
    // isLoading/isSearchingもリセットして、プログレスバーを非表示にする
    setIsLoading(false);
    setIsSearching(false);
    // 開始マーカー・延長マーカーもクリア
    setStartMarker(null);
    setExtensionMarkers([]);
    // 現在の議論設定もクリア
    setCurrentDiscussionMode(null);
    setCurrentDiscussionDepth(null);
    setCurrentDirectionGuide(null);
    setCurrentTerminationConfig(null);
    // 注: discussionParticipantsはクリアしない
    // セッション切り替え時にセッションの参加者が復元されるため
    // 注: interruptRequestedRefはここでリセットしない
    // SSEストリーム処理が中断を検出して状態を保存するまで維持する必要がある
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
    // AbortControllerがあればキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
        searchConfig,
        currentSessionRef,
        setInterruptedState,
        updateAndSaveSession,
      } = params;

      setSummaryState('generating');
      setError(null);
      // 復元・破棄ボタンをすぐに非表示にする
      setInterruptedState(null);

      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      interruptRequestedRef.current = false;

      // beforeSummary検索
      let summarySearchResults = currentSearchResults;
      const timing = searchConfig.timing || { onStart: true, beforeSummary: false, onDemand: false };
      if (searchConfig.enabled && timing.beforeSummary) {
        setIsSearching(true);
        try {
          // 議論内容をAIに渡してキーワードを生成
          const messagesForKeywords = currentMessages.map(m => ({
            provider: m.displayName || `${m.provider}/${m.model}`,
            content: m.content,
          }));

          const keywordsResponse = await fetch('/api/generate-search-keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: currentTopic,
              messages: messagesForKeywords,
              timing: 'summary',
              participant: participants[0],
            }),
            signal: abortControllerRef.current.signal,
          });

          let searchKeywords: string[] = [currentTopic]; // フォールバック
          if (keywordsResponse.ok) {
            const keywordsData = await keywordsResponse.json();
            if (keywordsData.keywords && keywordsData.keywords.length > 0) {
              searchKeywords = keywordsData.keywords;
            }
          }

          // 検索キーワード情報を追加
          const keywordInfo: SearchKeywordInfo = {
            timing: 'summary',
            keywords: searchKeywords,
            timestamp: new Date(),
          };
          setCurrentSearchKeywords(prev => [...prev, keywordInfo]);

          // 生成されたキーワードで検索
          for (const keyword of searchKeywords) {
            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: keyword,
                type: searchConfig.searchType,
                limit: Math.ceil(searchConfig.maxResults / searchKeywords.length),
                language: searchConfig.language || 'ja',
              }),
              signal: abortControllerRef.current.signal,
            });
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const newResults = searchData.results || [];
              // 既存の検索結果と統合（重複除去）
              const existingUrls = new Set(summarySearchResults.map(r => r.url));
              const uniqueNewResults = newResults.filter((r: SearchResult) => !existingUrls.has(r.url));
              summarySearchResults = [...summarySearchResults, ...uniqueNewResults];
            }
          }
          // 最大件数に制限
          summarySearchResults = summarySearchResults.slice(0, searchConfig.maxResults * 2); // 統合前は多めに
          setCurrentSearchResults(summarySearchResults);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合は正常終了
            setIsSearching(false);
            setSummaryState('idle');
            return;
          }
          console.error('beforeSummary search failed:', err);
        } finally {
          setIsSearching(false);
        }
      }

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
        // ===== ステージ1: 統合回答の生成 =====
        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: currentTopic,
            participants,
            messages: currentMessages,
            previousTurns,
            searchResults: summarySearchResults,
            userProfile,
            discussionMode,
            discussionDepth,
            directionGuide,
            messageVotes,
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to generate summary');
        }

        const handlers: SSEEventHandlers = {
          onProgress: () => {
            // Progress is tracked via summaryState
          },
          onSummaryChunk: (_chunk, accumulatedContent) => {
            // ストリーミング中のテキストをリアルタイム表示
            setCurrentFinalAnswer(accumulatedContent);
          },
          onSummary: (finalAnswer, summaryPrompt) => {
            collectedFinalAnswer = finalAnswer;
            collectedSummaryPrompt = summaryPrompt || '';
            setCurrentFinalAnswer(finalAnswer);
            setCurrentSummaryPrompt(summaryPrompt || '');
            // 状態遷移: 'generating' → 'idle'
            // 統合回答の生成が完了したので、アクションボタンを表示可能にする
            setSummaryState('idle');
          },
          onError: (errorMsg) => {
            console.error('Summary error:', errorMsg);
            setError(errorMsg);
          },
          onComplete: () => {
            setSummaryState('idle');
          },
        };

        const wasInterrupted = await processSSEStream(
          response,
          handlers,
          () => interruptRequestedRef.current
        );

        if (wasInterrupted) {
          // 中断された場合は状態をリセットして終了
          setSummaryState('idle');
          return;
        }

        // 統合回答が生成されたらすぐにセッションに保存
        // これにより、フォローアップ生成中に中断/リロードしても統合回答は保持される
        if (collectedFinalAnswer) {
          const newTurn = createNewTurn(
            currentTopic,
            currentMessages,
            collectedFinalAnswer,
            summarySearchResults.length > 0 ? summarySearchResults : undefined,
            collectedSummaryPrompt || undefined,
            undefined, // フォローアップはまだない
            startMarker || undefined,
            extensionMarkers.length > 0 ? extensionMarkers : undefined,
            currentSearchKeywords.length > 0 ? currentSearchKeywords : undefined
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
        }

        // ===== ステージ2: フォローアップ質問の生成 =====
        if (collectedFinalAnswer && !interruptRequestedRef.current) {
          setIsGeneratingFollowUps(true);

          // 新しいAbortControllerを作成（統合回答のAbortControllerは使い終わっている）
          abortControllerRef.current = new AbortController();

          try {
            const followupsResponse = await fetch('/api/followups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: currentTopic,
                finalAnswer: collectedFinalAnswer,
                participants,
                userProfile,
              }),
              signal: abortControllerRef.current?.signal,
            });

            if (followupsResponse.ok) {
              const followupsHandlers: SSEEventHandlers = {
                onFollowups: (followups) => {
                  setSuggestedFollowUps(followups);
                  // フォローアップ質問をターンに保存
                  const latestSession = currentSessionRef.current;
                  if (latestSession && latestSession.turns.length > 0) {
                    const updatedTurns = [...latestSession.turns];
                    const lastTurnIndex = updatedTurns.length - 1;
                    updatedTurns[lastTurnIndex] = {
                      ...updatedTurns[lastTurnIndex],
                      suggestedFollowUps: followups,
                    };
                    updateAndSaveSession({ turns: updatedTurns }, { async: true });
                  }
                },
                onError: (errorMsg) => {
                  console.error('Follow-up generation error:', errorMsg);
                  // フォローアップ生成のエラーは致命的ではないのでログのみ
                },
                onComplete: () => {
                  setIsGeneratingFollowUps(false);
                },
              };

              await processSSEStream(
                followupsResponse,
                followupsHandlers,
                () => interruptRequestedRef.current
              );
            }
          } catch (followupErr) {
            if (followupErr instanceof Error && followupErr.name === 'AbortError') {
              // フォローアップ生成の中断は正常（統合回答は既に保存済み）
            } else {
              console.error('Follow-up generation failed:', followupErr);
            }
          } finally {
            setIsGeneratingFollowUps(false);
          }
        }

        // 完了後の状態クリア
        if (collectedFinalAnswer) {
          clearCurrentTurnState();
          setMessageVotes([]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 中断された場合は正常終了
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        // AbortControllerをクリア
        abortControllerRef.current = null;
        // エラー時のフォールバック: summaryStateを確実にidleに戻す
        // 成功時はonSummaryで既にidleに設定されているので二重設定になるが問題ない
        setSummaryState('idle');
      }
    },
    [currentMessages, currentTopic, currentSearchResults, messageVotes, clearCurrentTurnState, startMarker, extensionMarkers]
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
      // 新しい議論開始時にsummaryStateをリセット
      // 前回の議論が'awaiting'や'generating'で終わっていた場合に備える
      setSummaryState('idle');
      // 新しい議論開始時に開始マーカーを設定、延長マーカーをクリア
      setStartMarker({
        totalRounds: terminationConfig.maxRounds,
        mode: discussionMode,
        depth: discussionDepth,
        keywords: directionGuide.keywords?.length ? directionGuide.keywords : undefined,
        timestamp: new Date(),
      });
      setExtensionMarkers([]);
      // 現在の議論設定を保存（延長時に参照するため）
      setCurrentDiscussionMode(discussionMode);
      setCurrentDiscussionDepth(discussionDepth);
      setCurrentDirectionGuide(directionGuide);
      setCurrentTerminationConfig(terminationConfig);
      setError(null);
      setIsLoading(true);
      setCurrentTopic(topic);
      setDiscussionParticipants(participants);
      setCompletedParticipants(new Set());
      interruptRequestedRef.current = false;
      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      setProgress({
        currentRound: 1,
        totalRounds: terminationConfig.maxRounds,
        currentParticipantIndex: 0,
        totalParticipants: participants.length,
        currentParticipant: participants[0],
      });

      // 検索（開始時）
      let searchResults: SearchResult[] = [];
      const timing = searchConfig.timing || { onStart: true, beforeSummary: false, onDemand: false };
      if (searchConfig.enabled && timing.onStart) {
        setIsSearching(true);
        try {
          // AIにキーワードを生成させる
          const keywordsResponse = await fetch('/api/generate-search-keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic,
              timing: 'start',
              participant: participants[0], // 最初の参加者のプロバイダーを使用
            }),
            signal: abortControllerRef.current.signal,
          });

          let searchKeywords: string[] = [topic]; // フォールバック
          if (keywordsResponse.ok) {
            const keywordsData = await keywordsResponse.json();
            if (keywordsData.keywords && keywordsData.keywords.length > 0) {
              searchKeywords = keywordsData.keywords;
            }
          }

          // 検索キーワード情報を保存
          const keywordInfo: SearchKeywordInfo = {
            timing: 'start',
            keywords: searchKeywords,
            timestamp: new Date(),
          };
          setCurrentSearchKeywords([keywordInfo]);

          // 生成されたキーワードで検索
          for (const keyword of searchKeywords) {
            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: keyword,
                type: searchConfig.searchType,
                limit: Math.ceil(searchConfig.maxResults / searchKeywords.length),
                language: searchConfig.language || 'ja',
              }),
              signal: abortControllerRef.current.signal,
            });
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const newResults = searchData.results || [];
              // 重複除去して追加
              const existingUrls = new Set(searchResults.map(r => r.url));
              const uniqueResults = newResults.filter((r: SearchResult) => !existingUrls.has(r.url));
              searchResults = [...searchResults, ...uniqueResults];
            }
          }
          // 最大件数に制限
          searchResults = searchResults.slice(0, searchConfig.maxResults);
          setCurrentSearchResults(searchResults);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合は正常終了
            setIsSearching(false);
            setIsLoading(false);
            return;
          }
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

      // 開始マーカーを作成（context用）
      const turnStartMarker: StartMarker = {
        totalRounds: terminationConfig.maxRounds,
        mode: discussionMode,
        depth: discussionDepth,
        keywords: directionGuide.keywords?.length ? directionGuide.keywords : undefined,
        timestamp: new Date(),
      };

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
        startMarker: turnStartMarker,
        extensionMarkers: [], // 新規議論なのでextensionMarkersは空
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
            searchConfig,
            userProfile,
            discussionMode,
            discussionDepth,
            directionGuide,
            terminationConfig,
            messageVotes,
            skipSummary: true,
          }),
          signal: abortControllerRef.current?.signal,
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
          setIsSearching,
          setCurrentSearchResults,
          setCurrentSearchKeywords,
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
          // 開始マーカーを作成
          const interruptedStartMarker: StartMarker = {
            totalRounds: terminationConfig.maxRounds,
            mode: discussionMode,
            depth: discussionDepth,
            keywords: directionGuide.keywords?.length ? directionGuide.keywords : undefined,
            timestamp: new Date(),
          };
          const interrupted = createInterruptedState({
            sessionId: sessionAtStart?.id || '',
            topic,
            participants,
            messages: collectedMessagesRef.current,
            currentRound: currentProgressStateRef.current.currentRound,
            currentParticipantIndex: currentProgressStateRef.current.currentParticipantIndex,
            totalRounds: terminationConfig.maxRounds,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            searchConfig,
            userProfile,
            discussionMode,
            discussionDepth,
            directionGuide,
            terminationConfig,
            startMarker: interruptedStartMarker,
            // 新規議論なのでextensionMarkersはなし
          });
          saveInterruptedState(interrupted);
          setInterruptedState(interrupted);
          setIsLoading(false);
          return;
        }

        if (collectedFinalAnswerRef.current) {
          // 開始マーカーを作成（startDiscussion内で設定した値と同じ）
          const turnStartMarker: StartMarker = {
            totalRounds: terminationConfig.maxRounds,
            mode: discussionMode,
            depth: discussionDepth,
            keywords: directionGuide.keywords?.length ? directionGuide.keywords : undefined,
            timestamp: new Date(),
          };
          const newTurn = createNewTurn(
            topic,
            collectedMessagesRef.current,
            collectedFinalAnswerRef.current,
            searchResults.length > 0 ? searchResults : undefined,
            collectedSummaryPromptRef.current || undefined,
            undefined, // suggestedFollowUps
            turnStartMarker,
            undefined, // 新規議論なのでextensionMarkersはなし
            currentSearchKeywords.length > 0 ? currentSearchKeywords : undefined
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
        if (err instanceof Error && err.name === 'AbortError') {
          // 中断された場合は正常終了
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        // AbortControllerをクリア
        abortControllerRef.current = null;
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
      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      setCompletedParticipants(new Set());
      setProgress({
        currentRound: interruptedState.currentRound,
        totalRounds: interruptedState.totalRounds,
        currentParticipantIndex: interruptedState.currentParticipantIndex,
        totalParticipants: interruptedState.participants.length,
        currentParticipant: interruptedState.participants[interruptedState.currentParticipantIndex],
      });
      // 中断状態からマーカーを復元
      if (interruptedState.startMarker) {
        setStartMarker(interruptedState.startMarker);
      }
      if (interruptedState.extensionMarkers) {
        setExtensionMarkers(interruptedState.extensionMarkers);
      }
      // 中断状態から議論設定を復元（延長時に参照するため）
      if (interruptedState.discussionMode) {
        setCurrentDiscussionMode(interruptedState.discussionMode);
      }
      if (interruptedState.discussionDepth) {
        setCurrentDiscussionDepth(interruptedState.discussionDepth);
      }
      if (interruptedState.directionGuide) {
        setCurrentDirectionGuide(interruptedState.directionGuide);
      }
      if (interruptedState.terminationConfig) {
        setCurrentTerminationConfig(interruptedState.terminationConfig);
      }

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
        startMarker: interruptedState.startMarker,
        extensionMarkers: interruptedState.extensionMarkers,
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
            searchConfig: interruptedState.searchConfig,
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
          signal: abortControllerRef.current?.signal,
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
          setIsSearching,
          setCurrentSearchResults,
          setCurrentSearchKeywords,
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
            searchConfig: interruptedState.searchConfig,
            userProfile: interruptedState.userProfile,
            discussionMode: interruptedState.discussionMode,
            discussionDepth: interruptedState.discussionDepth,
            directionGuide: interruptedState.directionGuide,
            terminationConfig: interruptedState.terminationConfig,
            // 中断前のマーカーを引き継ぐ
            startMarker: interruptedState.startMarker,
            extensionMarkers: interruptedState.extensionMarkers,
          });
          saveInterruptedState(newInterruptedState);
          setInterruptedState(newInterruptedState);
          setIsLoading(false);
          return;
        }

        if (collectedFinalAnswerRef.current) {
          // 中断状態から保存されたマーカーを使用、なければ設定から作成
          const turnStartMarker: StartMarker | undefined = interruptedState.startMarker || (
            interruptedState.discussionMode && interruptedState.discussionDepth ? {
              totalRounds: interruptedState.terminationConfig?.maxRounds || interruptedState.totalRounds,
              mode: interruptedState.discussionMode,
              depth: interruptedState.discussionDepth,
              keywords: interruptedState.directionGuide?.keywords?.length ? interruptedState.directionGuide.keywords : undefined,
              timestamp: new Date(),
            } : undefined
          );
          // 中断状態から保存された延長マーカーを使用、なければ現在の状態から
          const turnExtensionMarkers = interruptedState.extensionMarkers?.length
            ? interruptedState.extensionMarkers
            : (extensionMarkers.length > 0 ? extensionMarkers : undefined);
          const newTurn = createNewTurn(
            interruptedState.topic,
            collectedMessagesRef.current,
            collectedFinalAnswerRef.current,
            interruptedState.searchResults,
            collectedSummaryPromptRef.current || undefined,
            undefined, // suggestedFollowUps
            turnStartMarker,
            turnExtensionMarkers,
            currentSearchKeywords.length > 0 ? currentSearchKeywords : undefined
          );
          const latestSession = currentSessionRef.current;

          if (latestSession) {
            await updateAndSaveSession({
              turns: [...latestSession.turns, newTurn],
              interruptedTurn: undefined,
            });
          }

          clearCurrentTurnState();
          setSuggestedFollowUps([]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 中断された場合は正常終了
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        // AbortControllerをクリア
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [messageVotes, clearCurrentTurnState, extensionMarkers]
  );

  // 特定のターンに対してフォローアップ質問を生成
  const generateFollowUps = useCallback(
    async (params: GenerateFollowUpsParams) => {
      const {
        turnId,
        topic,
        finalAnswer,
        participants,
        userProfile,
        currentSessionRef,
        updateAndSaveSession,
      } = params;

      setIsGeneratingFollowUps(true);
      setError(null);

      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      interruptRequestedRef.current = false;

      try {
        const followupsResponse = await fetch('/api/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            finalAnswer,
            participants,
            userProfile,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!followupsResponse.ok) {
          throw new Error('Failed to generate follow-up questions');
        }

        const followupsHandlers: SSEEventHandlers = {
          onFollowups: (followups) => {
            setSuggestedFollowUps(followups);
            // フォローアップ質問をターンに保存
            const latestSession = currentSessionRef.current;
            if (latestSession) {
              const updatedTurns = latestSession.turns.map((turn) =>
                turn.id === turnId
                  ? { ...turn, suggestedFollowUps: followups }
                  : turn
              );
              updateAndSaveSession({ turns: updatedTurns }, { async: true });
            }
          },
          onError: (errorMsg) => {
            console.error('Follow-up generation error:', errorMsg);
            setError(errorMsg);
          },
          onComplete: () => {
            setIsGeneratingFollowUps(false);
          },
        };

        await processSSEStream(
          followupsResponse,
          followupsHandlers,
          () => interruptRequestedRef.current
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // 中断された場合は正常終了
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        abortControllerRef.current = null;
        setIsGeneratingFollowUps(false);
      }
    },
    []
  );

  // 議論を延長
  const extendDiscussion = useCallback(
    async (params: ExtendDiscussionParams) => {
      const {
        config,
        participants,
        searchConfig,
        userProfile,
        currentSessionRef,
        setCurrentSession,
        setSessions,
        setInterruptedState,
        updateAndSaveSession,
      } = params;

      // 現在の状態から延長用のInterruptedTurnStateを構築
      const currentSession = currentSessionRef.current;
      if (!currentSession) {
        setError('セッションが見つかりません');
        return;
      }

      // 現在の議論設定を使用（フック内の状態から取得）
      // 1回目の延長で変更された設定が正しく引き継がれる
      const discussionMode: DiscussionMode = currentDiscussionMode || 'free';
      const discussionDepth: DiscussionDepth = currentDiscussionDepth || 2;
      const directionGuide: DirectionGuide = currentDirectionGuide || { keywords: [] };
      const terminationConfig: TerminationConfig = currentTerminationConfig || { condition: 'rounds', maxRounds: 2 };

      // メッセージから完了済みラウンド数を計算（最も信頼性が高い）
      const completedRounds = currentMessages.length > 0
        ? Math.max(...currentMessages.map(m => m.round))
        : 0;

      // 新しい設定を適用
      const newMode = config.discussionMode || discussionMode;
      const newDepth = config.discussionDepth || discussionDepth;
      const newDirectionGuide = config.directionGuide || directionGuide;
      const newTotalRounds = completedRounds + config.additionalRounds;

      // 延長マーカーを作成
      const newMarker: ExtensionMarker = {
        afterRound: completedRounds,
        additionalRounds: config.additionalRounds,
        newTotalRounds,
        timestamp: new Date(),
      };

      // モード変更があれば記録
      if (config.discussionMode && config.discussionMode !== discussionMode) {
        newMarker.modeChanged = {
          from: discussionMode,
          to: config.discussionMode,
        };
      }

      // 深さ変更があれば記録
      if (config.discussionDepth && config.discussionDepth !== discussionDepth) {
        newMarker.depthChanged = {
          from: discussionDepth,
          to: config.discussionDepth,
        };
      }

      // キーワード追加があれば記録
      if (config.directionGuide?.keywords && config.directionGuide.keywords.length > 0) {
        // 既存のキーワードとの差分を取得
        const existingKeywords = new Set(directionGuide?.keywords || []);
        const newKeywords = config.directionGuide.keywords.filter(k => !existingKeywords.has(k));
        if (newKeywords.length > 0) {
          newMarker.keywordsAdded = newKeywords;
        }
      }

      // 延長マーカーリストを更新
      const updatedExtensionMarkers = [...extensionMarkers, newMarker];

      // InterruptedDiscussionStateを作成（マーカーを含める）
      const interruptedState: InterruptedDiscussionState = {
        sessionId: currentSession.id,
        topic: currentTopic,
        participants,
        messages: currentMessages,
        currentRound: completedRounds + 1, // 次のラウンドから開始
        currentParticipantIndex: 0,
        totalRounds: newTotalRounds,
        searchResults: currentSearchResults,
        searchConfig,
        userProfile,
        discussionMode: newMode,
        discussionDepth: newDepth,
        directionGuide: newDirectionGuide,
        terminationConfig: {
          ...terminationConfig,
          maxRounds: newTotalRounds,
        },
        interruptedAt: new Date(),
        summaryState: 'idle',
        startMarker: startMarker || undefined,
        extensionMarkers: updatedExtensionMarkers,
      };

      // 延長マーカーを状態に追加
      setExtensionMarkers(updatedExtensionMarkers);

      // 統合回答待ち状態をリセット
      setSummaryState('idle');
      setCurrentFinalAnswer('');
      setSuggestedFollowUps([]);

      // resumeDiscussionを呼び出して議論を再開
      await resumeDiscussion({
        interruptedState,
        restoreFromSession: () => {
          // 設定は既に適用済みなので何もしない
        },
        currentSessionRef,
        setCurrentSession,
        setSessions,
        setInterruptedState,
        updateAndSaveSession,
      });
    },
    [
      currentTopic,
      currentMessages,
      currentSearchResults,
      resumeDiscussion,
      startMarker,
      extensionMarkers,
      currentDiscussionMode,
      currentDiscussionDepth,
      currentDirectionGuide,
      currentTerminationConfig,
    ]
  );

  // 処理中フラグ（議論実行中、検索中、統合回答生成中、フォローアップ生成中）
  const isProcessing = isLoading || isSearching || summaryState === 'generating' || isGeneratingFollowUps;

  return {
    currentMessages,
    currentFinalAnswer,
    currentSummaryPrompt,
    currentTopic,
    currentSearchResults,
    currentSearchKeywords,
    isLoading,
    isSearching,
    isGeneratingFollowUps,
    isProcessing,
    summaryState,
    progress,
    completedParticipants,
    suggestedFollowUps,
    error,
    messageVotes,
    discussionParticipants,
    streamingMessage,
    startMarker,
    extensionMarkers,
    currentDiscussionMode,
    currentDiscussionDepth,
    currentDirectionGuide,
    currentTerminationConfig,
    setCurrentMessages,
    setCurrentFinalAnswer,
    setCurrentTopic,
    setCurrentSearchResults,
    setCurrentSearchKeywords,
    setError,
    setMessageVotes,
    handleVote,
    clearCurrentTurnState,
    restoreDiscussionState,
    handleInterrupt,
    startDiscussion,
    resumeDiscussion,
    extendDiscussion,
    generateSummary,
    generateFollowUps,
  };
}
