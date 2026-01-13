'use client';

import { useState, useCallback, useRef } from 'react';
import {
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSession,
  SearchResult,
  SearchKeywordInfo,
  SearchUiProgress,
  SearchWarning,
  MessageVote,
  FollowUpQuestion,
  InterruptedDiscussionSnapshot,
  InterruptedTurnSnapshot,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  SearchConfig,
  SummaryPhase,
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

export interface DiscussionUiProgress {
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

/** useDiscussion フックが提供する状態 */
export interface UseDiscussionState {
  currentMessages: DiscussionMessage[];
  currentFinalAnswer: string;
  currentSummaryPrompt: string;
  currentTopic: string;
  currentSearchResults: SearchResult[];
  currentSearchKeywords: SearchKeywordInfo[];
  isDiscussing: boolean;
  /** 検索中かどうか（searchProgress !== null から派生） */
  isSearching: boolean;
  isGeneratingFollowUps: boolean;
  isProcessing: boolean;
  summaryPhase: SummaryPhase;
  discussionProgress: DiscussionUiProgress;
  searchProgress: SearchUiProgress | null;
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
  searchKeywords?: SearchKeywordInfo[];
  summaryPhase?: SummaryPhase;
  startMarker?: StartMarker;
  extensionMarkers?: ExtensionMarker[];
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
}

/** useDiscussion フックが提供するアクション */
export interface UseDiscussionActions {
  setCurrentMessages: (updater: DiscussionMessage[] | ((prev: DiscussionMessage[]) => DiscussionMessage[])) => void;
  setCurrentFinalAnswer: (updater: string | ((prev: string) => string)) => void;
  setCurrentTopic: (updater: string | ((prev: string) => string)) => void;
  setCurrentSearchResults: (updater: SearchResult[] | ((prev: SearchResult[]) => SearchResult[])) => void;
  setCurrentSearchKeywords: (updater: SearchKeywordInfo[] | ((prev: SearchKeywordInfo[]) => SearchKeywordInfo[])) => void;
  setError: (updater: string | null | ((prev: string | null) => string | null)) => void;
  setMessageVotes: (updater: MessageVote[] | ((prev: MessageVote[]) => MessageVote[])) => void;
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

/** useDiscussion フックの戻り値 */
export type UseDiscussionReturn = UseDiscussionState & UseDiscussionActions;

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
  setInterruptedState: (state: InterruptedDiscussionSnapshot | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

export interface ResumeDiscussionParams {
  interruptedState: InterruptedDiscussionSnapshot;
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
  setInterruptedState: (state: InterruptedDiscussionSnapshot | null) => void;
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
  setInterruptedState: (state: InterruptedDiscussionSnapshot | null) => void;
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
  setInterruptedState: (state: InterruptedDiscussionSnapshot | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

const INITIAL_PROGRESS: DiscussionUiProgress = {
  currentRound: 0,
  totalRounds: 0,
  currentParticipantIndex: 0,
  totalParticipants: 0,
  currentParticipant: null,
};

// 議論設定の統合型
export interface CurrentSettings {
  discussionMode: DiscussionMode | null;
  discussionDepth: DiscussionDepth | null;
  directionGuide: DirectionGuide | null;
  terminationConfig: TerminationConfig | null;
}

const INITIAL_SETTINGS: CurrentSettings = {
  discussionMode: null,
  discussionDepth: null,
  directionGuide: null,
  terminationConfig: null,
};

// 検索データの統合型
export interface SearchData {
  results: SearchResult[];
  keywords: SearchKeywordInfo[];
}

const INITIAL_SEARCH_DATA: SearchData = {
  results: [],
  keywords: [],
};

// 統合回答データの統合型
export interface SummaryData {
  finalAnswer: string;
  prompt: string;
}

const INITIAL_SUMMARY_DATA: SummaryData = {
  finalAnswer: '',
  prompt: '',
};

// ============================================
// 共通のディスカッションコンテキスト型
// ============================================
interface DiscussionContext {
  topic: string;
  participants: DiscussionParticipant[];
  totalRounds: number;
  searchResults?: SearchResult[];
  searchKeywords?: SearchKeywordInfo[];
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
  setDiscussionUiProgress: React.Dispatch<React.SetStateAction<DiscussionUiProgress>>;
  setCurrentMessages: React.Dispatch<React.SetStateAction<DiscussionMessage[]>>;
  setCompletedParticipants: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCurrentFinalAnswer: React.Dispatch<React.SetStateAction<string>>;
  setCurrentSummaryPrompt: React.Dispatch<React.SetStateAction<string>>;
  setSuggestedFollowUps: React.Dispatch<React.SetStateAction<FollowUpQuestion[]>>;
  setIsGeneratingFollowUps: React.Dispatch<React.SetStateAction<boolean>>;
  setSummaryPhase?: React.Dispatch<React.SetStateAction<SummaryPhase>>;
  setIsDiscussing?: React.Dispatch<React.SetStateAction<boolean>>;
  // isSearchingは不要（searchProgressから派生）
  setSearchUiProgress?: React.Dispatch<React.SetStateAction<SearchUiProgress | null>>;
  setCurrentSearchResults?: (updater: SearchResult[] | ((prev: SearchResult[]) => SearchResult[])) => void;
  setCurrentSearchKeywords?: (updater: SearchKeywordInfo[] | ((prev: SearchKeywordInfo[]) => SearchKeywordInfo[])) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setStreamingMessage?: React.Dispatch<React.SetStateAction<StreamingMessage | null>>;
  collectedMessagesRef: { current: DiscussionMessage[] };
  collectedFinalAnswerRef: { current: string };
  collectedSummaryPromptRef: { current: string };
  collectedSearchKeywordsRef?: { current: SearchKeywordInfo[] };
  currentDiscussionUiProgressRef: { current: { currentRound: number; currentParticipantIndex: number } };
  includeReadyForSummary?: boolean;
}

function createDiscussionSSEHandlers(params: CreateSSEHandlersParams): SSEEventHandlers {
  const {
    context,
    currentSessionRef,
    setSessions,
    setCurrentSession,
    setDiscussionUiProgress,
    setCurrentMessages,
    setCompletedParticipants,
    setCurrentFinalAnswer,
    setCurrentSummaryPrompt,
    setSuggestedFollowUps,
    setIsGeneratingFollowUps,
    setSummaryPhase,
    setIsDiscussing,
    setSearchUiProgress,
    setCurrentSearchResults,
    setCurrentSearchKeywords,
    setError,
    setStreamingMessage,
    collectedMessagesRef,
    collectedFinalAnswerRef,
    collectedSummaryPromptRef,
    collectedSearchKeywordsRef,
    currentDiscussionUiProgressRef,
    includeReadyForSummary = false,
  } = params;

  return {
    onProgress: (progressData) => {
      currentDiscussionUiProgressRef.current = {
        currentRound: progressData.currentRound,
        currentParticipantIndex: progressData.currentParticipantIndex,
      };
      setDiscussionUiProgress({
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
      const currentRound = currentDiscussionUiProgressRef.current.currentRound;
      const currentPIndex = currentDiscussionUiProgressRef.current.currentParticipantIndex;
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
        // 検索キーワードと完了インデックスを決定
        const searchKeywordsForSave = collectedSearchKeywordsRef?.current?.length ? collectedSearchKeywordsRef.current : context.searchKeywords;
        const completedKeywordIndexForSave = searchKeywordsForSave && searchKeywordsForSave.length > 0 && searchKeywordsForSave[0].keywords.length > 0
          ? searchKeywordsForSave[0].keywords.length - 1  // 議論中なので検索は完了している
          : undefined;

        const interruptedTurn: InterruptedTurnSnapshot = {
          topic: context.topic,
          participants: context.participants,
          messages: collectedMessagesRef.current,
          currentRound: nextRound,
          currentParticipantIndex: nextParticipantIndex,
          totalRounds: context.totalRounds,
          searchResults: context.searchResults,
          searchKeywords: searchKeywordsForSave,
          completedSearchKeywordIndex: completedKeywordIndexForSave,
          userProfile: context.userProfile,
          discussionMode: context.discussionMode,
          discussionDepth: context.discussionDepth,
          directionGuide: context.directionGuide,
          terminationConfig: context.terminationConfig,
          interruptedAt: new Date(),
          summaryPhase: isAllComplete ? 'awaiting' : 'idle',
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
      const currentParticipantIndex = currentDiscussionUiProgressRef.current.currentParticipantIndex;
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
          setSummaryPhase?.('awaiting');
          setIsDiscussing?.(false);
          const latestSession = currentSessionRef.current;
          if (latestSession) {
            // summaryPhase: 'awaiting'状態を保持した中断状態を保存
            const searchKeywordsForAwait = collectedSearchKeywordsRef?.current?.length ? collectedSearchKeywordsRef.current : context.searchKeywords;
            const completedKeywordIndexForAwait = searchKeywordsForAwait && searchKeywordsForAwait.length > 0 && searchKeywordsForAwait[0].keywords.length > 0
              ? searchKeywordsForAwait[0].keywords.length - 1
              : undefined;

            const interruptedTurn: InterruptedTurnSnapshot = {
              topic: context.topic,
              participants: context.participants,
              messages: collectedMessagesRef.current,
              currentRound: currentDiscussionUiProgressRef.current.currentRound,
              currentParticipantIndex: currentDiscussionUiProgressRef.current.currentParticipantIndex,
              totalRounds: context.totalRounds,
              searchResults: context.searchResults,
              searchKeywords: searchKeywordsForAwait,
              completedSearchKeywordIndex: completedKeywordIndexForAwait,
              userProfile: context.userProfile,
              discussionMode: context.discussionMode,
              discussionDepth: context.discussionDepth,
              directionGuide: context.directionGuide,
              terminationConfig: context.terminationConfig,
              interruptedAt: new Date(),
              summaryPhase: 'awaiting',
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
      setIsDiscussing?.(false);
      setIsGeneratingFollowUps(false);
      // 注意: ここでsummaryPhaseを'idle'にしない
      // startDiscussionの場合: onReadyForSummaryで'awaiting'に設定されるので、それを維持する
      // generateSummaryの場合: onSummaryで'idle'に設定されるので、ここでは不要
    },
    onSearching: () => {
      // 検索開始時はキーワード生成中フェーズとして表示
      setSearchUiProgress?.({
        phase: 'keywords',
        currentKeywordIndex: 0,
        totalKeywords: 0,
        completedKeywords: [],
      });
    },
    onSearchResults: (searchResults) => {
      setSearchUiProgress?.(null);
      setCurrentSearchResults?.(searchResults);
      // 最後に追加されたSearchKeywordInfoに結果を紐付け
      if (collectedSearchKeywordsRef && collectedSearchKeywordsRef.current.length > 0) {
        const lastIndex = collectedSearchKeywordsRef.current.length - 1;
        collectedSearchKeywordsRef.current[lastIndex] = {
          ...collectedSearchKeywordsRef.current[lastIndex],
          results: searchResults,
        };
        setCurrentSearchKeywords?.([...collectedSearchKeywordsRef.current]);
      }
    },
    onSearchKeywords: (searchKeywords) => {
      setCurrentSearchKeywords?.(prev => [...prev, searchKeywords]);
      // refにも追加して、クロージャ内でも最新の値を参照できるようにする
      if (collectedSearchKeywordsRef) {
        collectedSearchKeywordsRef.current = [...collectedSearchKeywordsRef.current, searchKeywords];
      }
      // 検索進捗を更新（キーワードが確定したので検索フェーズへ）
      setSearchUiProgress?.({
        phase: 'searching',
        currentKeywordIndex: 0,
        totalKeywords: searchKeywords.keywords.length,
        currentKeyword: searchKeywords.keywords[0],
        completedKeywords: [],
      });
    },
    onSearchProgress: (progress) => {
      // 検索進捗を更新
      setSearchUiProgress?.((prev) => {
        if (!prev) return prev;
        const newState = {
          ...prev,
          currentKeywordIndex: progress.currentKeywordIndex,
          currentKeyword: progress.currentKeyword,
        };
        // キーワードが完了した場合、completedKeywordsに追加
        if (progress.completedKeyword && !prev.completedKeywords.includes(progress.completedKeyword)) {
          newState.completedKeywords = [...prev.completedKeywords, progress.completedKeyword];
        }
        return newState;
      });
    },
  };
}

// ============================================
// useDiscussion フック
// ============================================
export function useDiscussion(): UseDiscussionReturn {
  const [currentMessages, setCurrentMessages] = useState<DiscussionMessage[]>([]);
  // 統合回答データ（回答とプロンプト）- 統合
  const [summaryData, setSummaryData] = useState<SummaryData>(INITIAL_SUMMARY_DATA);
  const [currentTopic, setCurrentTopic] = useState<string>('');
  // 検索データ（結果とキーワード）- 統合
  const [searchData, setSearchData] = useState<SearchData>(INITIAL_SEARCH_DATA);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [searchProgress, setSearchUiProgress] = useState<SearchUiProgress | null>(null);
  const [isGeneratingFollowUps, setIsGeneratingFollowUps] = useState(false);
  const [summaryPhase, setSummaryPhase] = useState<SummaryPhase>('idle');
  const [discussionProgress, setDiscussionUiProgress] = useState<DiscussionUiProgress>(INITIAL_PROGRESS);
  const [completedParticipants, setCompletedParticipants] = useState<Set<string>>(new Set());
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<FollowUpQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messageVotes, setMessageVotes] = useState<MessageVote[]>([]);
  const [discussionParticipants, setDiscussionParticipants] = useState<DiscussionParticipant[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [startMarker, setStartMarker] = useState<StartMarker | null>(null);
  const [extensionMarkers, setExtensionMarkers] = useState<ExtensionMarker[]>([]);
  // 現在の議論で使用中の設定（延長時に参照するため）- 統合
  const [currentSettings, setCurrentSettings] = useState<CurrentSettings>(INITIAL_SETTINGS);

  const interruptRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // searchDataから派生（後方互換）
  const currentSearchResults = searchData.results;
  const currentSearchKeywords = searchData.keywords;

  // searchData更新用ヘルパー
  const setCurrentSearchResults = useCallback((updater: SearchResult[] | ((prev: SearchResult[]) => SearchResult[])) => {
    setSearchData(prev => ({
      ...prev,
      results: typeof updater === 'function' ? updater(prev.results) : updater,
    }));
  }, []);

  const setCurrentSearchKeywords = useCallback((updater: SearchKeywordInfo[] | ((prev: SearchKeywordInfo[]) => SearchKeywordInfo[])) => {
    setSearchData(prev => ({
      ...prev,
      keywords: typeof updater === 'function' ? updater(prev.keywords) : updater,
    }));
  }, []);

  // summaryDataから派生（後方互換）
  const currentFinalAnswer = summaryData.finalAnswer;
  const currentSummaryPrompt = summaryData.prompt;

  // summaryData更新用ヘルパー
  const setCurrentFinalAnswer = useCallback((updater: string | ((prev: string) => string)) => {
    setSummaryData(prev => ({
      ...prev,
      finalAnswer: typeof updater === 'function' ? updater(prev.finalAnswer) : updater,
    }));
  }, []);

  const setCurrentSummaryPrompt = useCallback((updater: string | ((prev: string) => string)) => {
    setSummaryData(prev => ({
      ...prev,
      prompt: typeof updater === 'function' ? updater(prev.prompt) : updater,
    }));
  }, []);

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

  // 全ての状態を初期値にリセット
  const resetAllState = useCallback(() => {
    // メッセージ・回答関連
    setCurrentMessages([]);
    setCurrentFinalAnswer('');
    setCurrentSummaryPrompt('');
    setCurrentTopic('');
    // 検索関連
    setSearchData(INITIAL_SEARCH_DATA);
    // ローディング・進行状況
    setIsDiscussing(false);
    setIsGeneratingFollowUps(false);
    setSummaryPhase('idle');
    setDiscussionUiProgress(INITIAL_PROGRESS);
    setCompletedParticipants(new Set());
    setSearchUiProgress(null);
    // フォローアップ・投票
    setSuggestedFollowUps([]);
    setMessageVotes([]);
    // エラー・ストリーミング
    setError(null);
    setStreamingMessage(null);
    // 参加者（意図的にクリアしない場合はコメントアウト）
    // setDiscussionParticipants([]);
    // マーカー
    setStartMarker(null);
    setExtensionMarkers([]);
    // 議論設定
    setCurrentSettings(INITIAL_SETTINGS);
  }, []);

  const clearCurrentTurnState = useCallback(() => {
    resetAllState();
    // 注: suggestedFollowUpsはresetAllStateでクリアされる
    // 注: discussionParticipantsはresetAllStateでクリアしない（セッション復元用に保持）
    // 注: interruptRequestedRefはここでリセットしない
    // SSEストリーム処理が中断を検出して状態を保存するまで維持する必要がある
  }, [resetAllState]);

  const restoreDiscussionState = useCallback((params: RestoreDiscussionStateParams) => {
    // 全状態を初期化してからパラメータで上書き
    resetAllState();
    // 固有の設定を上書き
    setCurrentTopic(params.topic);
    setCurrentMessages(params.messages);
    setSearchData({
      results: params.searchResults || [],
      keywords: params.searchKeywords || [],
    });
    setSummaryPhase(params.summaryPhase || 'idle');
    // マーカーと議論設定を復元
    setStartMarker(params.startMarker || null);
    setExtensionMarkers(params.extensionMarkers || []);
    setCurrentSettings({
      discussionMode: params.discussionMode || null,
      discussionDepth: params.discussionDepth || null,
      directionGuide: params.directionGuide || null,
      terminationConfig: params.terminationConfig || null,
    });
  }, [resetAllState]);

  const handleInterrupt = useCallback(() => {
    interruptRequestedRef.current = true;
    // AbortControllerがあればキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // ストリーミングメッセージをクリア（中断時の残留を防ぐ）
    setStreamingMessage(null);
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

      setSummaryPhase('generating');
      setError(null);
      // 復元・破棄ボタンをすぐに非表示にする
      setInterruptedState(null);

      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      interruptRequestedRef.current = false;

      // beforeSummary検索
      let summarySearchResults = currentSearchResults;
      let summaryKeywordInfo: SearchKeywordInfo | null = null; // 統合前検索のキーワード情報（後でターンに保存）
      const timing = searchConfig.timing || { onStart: true, beforeSummary: false, onDemand: false };
      if (searchConfig.enabled && timing.beforeSummary) {
        setSearchUiProgress({
          phase: 'searching',
          currentKeywordIndex: 0,
          totalKeywords: 1,
          completedKeywords: [],
        });
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

          // 生成されたキーワードで検索
          const summaryKeywordResults: SearchResult[] = [];
          for (const keyword of searchKeywords) {
            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: keyword,
                type: searchConfig.searchType,
                limit: Math.ceil(searchConfig.maxResults / searchKeywords.length),
                language: searchConfig.language || 'ja',
                provider: searchConfig.provider,
                engines: searchConfig.engines,
                fetchFullContent: searchConfig.fetchFullContent,
                fullContentLimit: searchConfig.fullContentMaxResults,
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
              summaryKeywordResults.push(...newResults);
            }
          }
          // 最大件数に制限
          summarySearchResults = summarySearchResults.slice(0, searchConfig.maxResults);
          setCurrentSearchResults(summarySearchResults);

          // 検索キーワード情報を追加（検索結果を含む、最大件数に制限）
          summaryKeywordInfo = {
            timing: 'summary',
            keywords: searchKeywords,
            timestamp: new Date(),
            results: summaryKeywordResults.slice(0, searchConfig.maxResults),
          };
          setCurrentSearchKeywords(prev => [...prev, summaryKeywordInfo!]);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合は正常終了
            setSummaryPhase('idle');
            return;
          }
          console.error('beforeSummary search failed:', err);
        } finally {
          setSearchUiProgress(null);
        }
      }

      // セッションのinterruptedTurnを統合回答生成中状態に更新
      // クリアするのではなく、summaryPhase: 'generating'で更新することでリロード時に復元可能にする
      if (currentSessionRef.current?.interruptedTurn) {
        await updateAndSaveSession({
          interruptedTurn: {
            ...currentSessionRef.current.interruptedTurn,
            summaryPhase: 'generating',
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
            // Progress is tracked via summaryPhase
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
            setSummaryPhase('idle');
          },
          onError: (errorMsg) => {
            console.error('Summary error:', errorMsg);
            setError(errorMsg);
          },
          onComplete: () => {
            setSummaryPhase('idle');
          },
        };

        const wasInterrupted = await processSSEStream(
          response,
          handlers,
          () => interruptRequestedRef.current
        );

        if (wasInterrupted) {
          // 中断された場合は状態をリセットして終了
          setSummaryPhase('idle');
          return;
        }

        // 統合回答が生成されたらすぐにセッションに保存
        // これにより、フォローアップ生成中に中断/リロードしても統合回答は保持される
        if (collectedFinalAnswer) {
          // 統合前検索キーワードを含む完全なキーワードリストを作成
          const allSearchKeywords = summaryKeywordInfo
            ? [...currentSearchKeywords, summaryKeywordInfo]
            : currentSearchKeywords;
          const newTurn = createNewTurn(
            currentTopic,
            currentMessages,
            collectedFinalAnswer,
            summarySearchResults.length > 0 ? summarySearchResults : undefined,
            collectedSummaryPrompt || undefined,
            undefined, // フォローアップはまだない
            startMarker || undefined,
            extensionMarkers.length > 0 ? extensionMarkers : undefined,
            allSearchKeywords.length > 0 ? allSearchKeywords : undefined
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
        // エラー時のフォールバック: summaryPhaseを確実にidleに戻す
        // 成功時はonSummaryで既にidleに設定されているので二重設定になるが問題ない
        setSummaryPhase('idle');
      }
    },
    [currentMessages, currentTopic, currentSearchResults, currentSearchKeywords, messageVotes, clearCurrentTurnState, startMarker, extensionMarkers]
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

      // 全状態を初期化してから固有の設定を上書き
      resetAllState();
      // 新しい議論開始時に開始マーカーを設定
      setStartMarker({
        totalRounds: terminationConfig.maxRounds,
        mode: discussionMode,
        depth: discussionDepth,
        keywords: directionGuide.keywords?.length ? directionGuide.keywords : undefined,
        timestamp: new Date(),
      });
      // 現在の議論設定を保存（延長時に参照するため）
      setCurrentSettings({
        discussionMode,
        discussionDepth,
        directionGuide,
        terminationConfig,
      });
      setIsDiscussing(true);
      setCurrentTopic(topic);
      setDiscussionParticipants(participants);
      interruptRequestedRef.current = false;
      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      setDiscussionUiProgress({
        currentRound: 1,
        totalRounds: terminationConfig.maxRounds,
        currentParticipantIndex: 0,
        totalParticipants: participants.length,
        currentParticipant: participants[0],
      });

      // 既存のセッションを取得、または新規作成
      // セッション作成を検索前に移動（検索中の中断でも状態保存できるように）
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

      // 検索（開始時）
      let searchResults: SearchResult[] = [];
      let collectedSearchKeywords: SearchKeywordInfo[] = [];
      let lastCompletedKeywordIndex = -1; // 完了した検索キーワードのインデックス（中断時の再開用）
      const timing = searchConfig.timing || { onStart: true, beforeSummary: false, onDemand: false };
      if (searchConfig.enabled && timing.onStart) {
        setSearchUiProgress({
          phase: 'keywords',
          currentKeywordIndex: 0,
          totalKeywords: 0,
          completedKeywords: [],
        });
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
          let keywordPrompt: string | undefined;
          if (keywordsResponse.ok) {
            const keywordsData = await keywordsResponse.json();
            if (keywordsData.keywords && keywordsData.keywords.length > 0) {
              searchKeywords = keywordsData.keywords;
            }
            keywordPrompt = keywordsData.prompt;
          }

          // 検索キーワード情報を保存
          const keywordInfo: SearchKeywordInfo = {
            timing: 'start',
            keywords: searchKeywords,
            timestamp: new Date(),
            prompt: keywordPrompt,
          };
          collectedSearchKeywords = [keywordInfo];
          setCurrentSearchKeywords([keywordInfo]);

          // 進捗を更新（検索フェーズへ）
          setSearchUiProgress({
            phase: 'searching',
            currentKeywordIndex: 0,
            totalKeywords: searchKeywords.length,
            currentKeyword: searchKeywords[0],
            completedKeywords: [],
            warnings: [],
          });

          // 警告を収集
          const collectedWarnings: SearchWarning[] = [];

          // 生成されたキーワードで検索（逐次表示）
          for (let i = 0; i < searchKeywords.length; i++) {
            const keyword = searchKeywords[i];

            // 進捗を更新
            setSearchUiProgress((prev) => prev ? {
              ...prev,
              currentKeywordIndex: i,
              currentKeyword: keyword,
            } : null);

            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: keyword,
                type: searchConfig.searchType,
                limit: Math.ceil(searchConfig.maxResults / searchKeywords.length),
                language: searchConfig.language || 'ja',
                provider: searchConfig.provider,
                engines: searchConfig.engines,
                fetchFullContent: searchConfig.fetchFullContent,
                fullContentLimit: searchConfig.fullContentMaxResults,
                // 関連性フィルタリング用パラメータ
                topic,
                relevanceFilter: searchConfig.relevanceFilter,
                defaultAIProvider: participants[0]?.provider,
                defaultAIModel: participants[0]?.model,
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

              // 結果を即座に表示（最大件数に制限）
              const limitedResults = searchResults.slice(0, searchConfig.maxResults);
              setCurrentSearchResults(limitedResults);

              // 警告を収集
              if (searchData.warnings && searchData.warnings.length > 0) {
                for (const warnType of searchData.warnings) {
                  collectedWarnings.push({
                    type: warnType,
                    keyword,
                  });
                }
              }
            }

            // 進捗を更新（完了したキーワードを追加、警告も含む）
            lastCompletedKeywordIndex = i;
            setSearchUiProgress((prev) => prev ? {
              ...prev,
              completedKeywords: [...prev.completedKeywords, keyword],
              warnings: [...collectedWarnings],
            } : null);
          }

          // 検索完了
          setSearchUiProgress({
            phase: 'done',
            currentKeywordIndex: searchKeywords.length,
            totalKeywords: searchKeywords.length,
            completedKeywords: searchKeywords,
            warnings: collectedWarnings.length > 0 ? collectedWarnings : undefined,
          });

          // 検索結果をSearchKeywordInfoに紐付け
          const limitedResults = searchResults.slice(0, searchConfig.maxResults);
          if (collectedSearchKeywords.length > 0) {
            collectedSearchKeywords[0] = {
              ...collectedSearchKeywords[0],
              results: limitedResults,
            };
            setCurrentSearchKeywords([...collectedSearchKeywords]);
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合：検索進捗を保存してセッションに記録
            const latestSession = currentSessionRef.current || sessionAtStart;
            if (latestSession && collectedSearchKeywords.length > 0) {
              const interruptedTurn: InterruptedTurnSnapshot = {
                topic,
                participants,
                messages: [],
                currentRound: 1,
                currentParticipantIndex: 0,
                totalRounds: terminationConfig.maxRounds,
                searchResults: searchResults.length > 0 ? searchResults : undefined,
                searchKeywords: collectedSearchKeywords,
                completedSearchKeywordIndex: lastCompletedKeywordIndex,
                searchConfig,
                userProfile,
                discussionMode,
                discussionDepth,
                directionGuide,
                terminationConfig,
                interruptedAt: new Date(),
                summaryPhase: 'idle',
                // 検索中断時はまだ議論が開始されていないので、マーカーは未定義
                startMarker: undefined,
                extensionMarkers: undefined,
              };
              const updatedSession: DiscussionSession = {
                ...latestSession,
                interruptedTurn,
                updatedAt: new Date(),
              };
              saveSession(updatedSession).catch((err) =>
                console.error('Failed to save interrupted search state:', err)
              );
              setCurrentSession(updatedSession);
              setSessions((prev) =>
                prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
              );
            }
            setIsDiscussing(false);
            return;
          }
          console.error('Search failed:', err);
        } finally {
          setSearchUiProgress(null);
        }
      }

      // 収集用のref
      const collectedMessagesRef = { current: [] as DiscussionMessage[] };
      const collectedFinalAnswerRef = { current: '' };
      const collectedSummaryPromptRef = { current: '' };
      const collectedSearchKeywordsRef = { current: collectedSearchKeywords };
      const currentDiscussionUiProgressRef = { current: { currentRound: 1, currentParticipantIndex: 0 } };

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
        searchKeywords: collectedSearchKeywords.length > 0 ? collectedSearchKeywords : undefined,
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
          setDiscussionUiProgress,
          setCurrentMessages,
          setCompletedParticipants,
          setCurrentFinalAnswer,
          setCurrentSummaryPrompt,
          setSuggestedFollowUps,
          setIsGeneratingFollowUps,
          setSummaryPhase,
          setIsDiscussing,
          setSearchUiProgress,
          setCurrentSearchResults,
          setCurrentSearchKeywords,
          setError,
          setStreamingMessage,
          collectedMessagesRef,
          collectedFinalAnswerRef,
          collectedSummaryPromptRef,
          collectedSearchKeywordsRef,
          currentDiscussionUiProgressRef,
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
          // 検索完了後の中断の場合、全キーワードが完了しているのでその情報を保存
          const searchKeywordsForInterrupted = collectedSearchKeywordsRef.current;
          const completedKeywordIndexForInterrupted = searchKeywordsForInterrupted.length > 0 && searchKeywordsForInterrupted[0].keywords.length > 0
            ? searchKeywordsForInterrupted[0].keywords.length - 1  // 最後のキーワードまで完了
            : undefined;

          const interrupted = createInterruptedState({
            sessionId: sessionAtStart?.id || '',
            topic,
            participants,
            messages: collectedMessagesRef.current,
            currentRound: currentDiscussionUiProgressRef.current.currentRound,
            currentParticipantIndex: currentDiscussionUiProgressRef.current.currentParticipantIndex,
            totalRounds: terminationConfig.maxRounds,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            searchKeywords: searchKeywordsForInterrupted.length > 0 ? searchKeywordsForInterrupted : undefined,
            completedSearchKeywordIndex: completedKeywordIndexForInterrupted,
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
          setIsDiscussing(false);
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
            collectedSearchKeywordsRef.current.length > 0 ? collectedSearchKeywordsRef.current : undefined
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
        setIsDiscussing(false);
        setSearchUiProgress(null);
      }
    },
    [currentTopic, currentFinalAnswer, messageVotes, clearCurrentTurnState, resetAllState]
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

      // 再開情報をログ出力
      console.log('[resumeDiscussion] Resuming discussion:', {
        sessionId: interruptedState.sessionId,
        topic: interruptedState.topic,
        currentRound: interruptedState.currentRound,
        totalRounds: interruptedState.totalRounds,
        currentParticipantIndex: interruptedState.currentParticipantIndex,
        totalParticipants: interruptedState.participants.length,
        messagesCount: interruptedState.messages.length,
        searchResultsCount: interruptedState.searchResults?.length || 0,
        searchKeywordsCount: interruptedState.searchKeywords?.length || 0,
        completedSearchKeywordIndex: interruptedState.completedSearchKeywordIndex ?? -1,
        interruptedAt: interruptedState.interruptedAt,
      });

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
      setIsDiscussing(true);
      setError(null);
      interruptRequestedRef.current = false;
      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      setCompletedParticipants(new Set());
      setDiscussionUiProgress({
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
      setCurrentSettings({
        discussionMode: interruptedState.discussionMode || null,
        discussionDepth: interruptedState.discussionDepth || null,
        directionGuide: interruptedState.directionGuide || null,
        terminationConfig: interruptedState.terminationConfig || null,
      });

      // 検索が有効で、まだ検索が完了していない場合は検索を実行
      // （検索中に中断された場合の対応）
      let searchResults = interruptedState.searchResults || [];
      let collectedSearchKeywords = interruptedState.searchKeywords || [];
      const searchConfig = interruptedState.searchConfig;
      const timing = searchConfig?.timing || { onStart: true, beforeSummary: false, onDemand: false };

      // 検索が必要かどうかを判定:
      // - 検索が有効で開始時検索が設定されている
      // - まだメッセージがない（議論が始まっていない）
      // - キーワードがない、または検索が完了していない（途中で中断された）
      const completedKeywordIndex = interruptedState.completedSearchKeywordIndex ?? -1;
      const hasMoreKeywordsToSearch = collectedSearchKeywords.length > 0 &&
        collectedSearchKeywords[0].keywords.length > completedKeywordIndex + 1;
      const needsSearch = searchConfig?.enabled &&
        timing.onStart &&
        interruptedState.messages.length === 0 &&
        (collectedSearchKeywords.length === 0 || hasMoreKeywordsToSearch);

      // 検索が不要でも、既存の検索キーワードがあれば状態に設定
      if (!needsSearch && collectedSearchKeywords.length > 0) {
        setCurrentSearchKeywords(collectedSearchKeywords);
      }

      if (needsSearch) {
        console.log('[resumeDiscussion] Resuming search:', {
          hasExistingKeywords: collectedSearchKeywords.length > 0,
          totalKeywords: collectedSearchKeywords[0]?.keywords.length || 0,
          completedKeywordIndex,
          startingFromIndex: completedKeywordIndex + 1,
          existingSearchResults: searchResults.length,
        });

        setSearchUiProgress({
          phase: 'keywords',
          currentKeywordIndex: 0,
          totalKeywords: 0,
          completedKeywords: [],
        });
        // 完了したキーワードのインデックスを追跡（中断時の再開用）- try外で宣言
        let lastCompletedKeywordIndex = completedKeywordIndex;
        try {
          // キーワードがまだない場合のみ生成
          let searchKeywordsList: string[] = [];
          if (collectedSearchKeywords.length > 0 && collectedSearchKeywords[0].keywords.length > 0) {
            // 既存のキーワードを使用
            searchKeywordsList = collectedSearchKeywords[0].keywords;
            setCurrentSearchKeywords(collectedSearchKeywords);
          } else {
            // AIにキーワードを生成させる
            const keywordsResponse = await fetch('/api/generate-search-keywords', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: interruptedState.topic,
                timing: 'start',
                participant: interruptedState.participants[0],
              }),
              signal: abortControllerRef.current.signal,
            });

            searchKeywordsList = [interruptedState.topic]; // フォールバック
            let keywordPrompt: string | undefined;
            if (keywordsResponse.ok) {
              const keywordsData = await keywordsResponse.json();
              if (keywordsData.keywords && keywordsData.keywords.length > 0) {
                searchKeywordsList = keywordsData.keywords;
              }
              keywordPrompt = keywordsData.prompt;
            }

            // 検索キーワード情報を保存
            const keywordInfo: SearchKeywordInfo = {
              timing: 'start',
              keywords: searchKeywordsList,
              timestamp: new Date(),
              prompt: keywordPrompt,
            };
            collectedSearchKeywords = [keywordInfo];
            setCurrentSearchKeywords([keywordInfo]);
          }

          // 途中から再開する場合の開始インデックス
          const startIndex = completedKeywordIndex + 1;
          const completedKeywordsList = searchKeywordsList.slice(0, startIndex);

          // 進捗を更新（検索フェーズへ）
          setSearchUiProgress({
            phase: 'searching',
            currentKeywordIndex: startIndex,
            totalKeywords: searchKeywordsList.length,
            currentKeyword: searchKeywordsList[startIndex],
            completedKeywords: completedKeywordsList,
            warnings: [],
          });

          // 警告を収集
          const collectedWarnings: SearchWarning[] = [];

          // 未完了のキーワードから検索を実行
          if (startIndex < searchKeywordsList.length) {
            for (let i = startIndex; i < searchKeywordsList.length; i++) {
              const keyword = searchKeywordsList[i];

              // 進捗を更新
              setSearchUiProgress((prev) => prev ? {
                ...prev,
                currentKeywordIndex: i,
                currentKeyword: keyword,
              } : null);

              const searchResponse = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: keyword,
                  type: searchConfig.searchType,
                  limit: Math.ceil(searchConfig.maxResults / searchKeywordsList.length),
                  language: searchConfig.language || 'ja',
                  provider: searchConfig.provider,
                  engines: searchConfig.engines,
                  fetchFullContent: searchConfig.fetchFullContent,
                  fullContentLimit: searchConfig.fullContentMaxResults,
                  topic: interruptedState.topic,
                  relevanceFilter: searchConfig.relevanceFilter,
                  defaultAIProvider: interruptedState.participants[0]?.provider,
                  defaultAIModel: interruptedState.participants[0]?.model,
                }),
                signal: abortControllerRef.current.signal,
              });
              if (searchResponse.ok) {
                const searchDataJson = await searchResponse.json();
                const newResults = searchDataJson.results || [];
                const existingUrls = new Set(searchResults.map(r => r.url));
                const uniqueResults = newResults.filter((r: SearchResult) => !existingUrls.has(r.url));
                searchResults = [...searchResults, ...uniqueResults];

                // 結果を即座に表示（最大件数に制限）
                const limitedResults = searchResults.slice(0, searchConfig.maxResults);
                setCurrentSearchResults(limitedResults);

                // 警告を収集
                if (searchDataJson.warnings && searchDataJson.warnings.length > 0) {
                  for (const warnType of searchDataJson.warnings) {
                    collectedWarnings.push({
                      type: warnType,
                      keyword,
                    });
                  }
                }
              }

              // 進捗を更新（完了したキーワードを追加、警告も含む）
              lastCompletedKeywordIndex = i;
              setSearchUiProgress((prev) => prev ? {
                ...prev,
                completedKeywords: [...prev.completedKeywords, keyword],
                warnings: [...collectedWarnings],
              } : null);
            }
          }

          // 検索完了
          setSearchUiProgress({
            phase: 'done',
            currentKeywordIndex: searchKeywordsList.length,
            totalKeywords: searchKeywordsList.length,
            completedKeywords: searchKeywordsList,
            warnings: collectedWarnings.length > 0 ? collectedWarnings : undefined,
          });

          // 検索結果をSearchKeywordInfoに紐付け
          const limitedResults = searchResults.slice(0, searchConfig.maxResults);
          if (collectedSearchKeywords.length > 0) {
            collectedSearchKeywords[0] = {
              ...collectedSearchKeywords[0],
              results: limitedResults,
            };
            setCurrentSearchKeywords([...collectedSearchKeywords]);
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合：検索進捗を保存してセッションに記録
            const latestSession = currentSessionRef.current;
            if (latestSession && collectedSearchKeywords.length > 0) {
              const interruptedTurn: InterruptedTurnSnapshot = {
                topic: interruptedState.topic,
                participants: interruptedState.participants,
                messages: interruptedState.messages,
                currentRound: interruptedState.currentRound,
                currentParticipantIndex: interruptedState.currentParticipantIndex,
                totalRounds: interruptedState.totalRounds,
                searchResults: searchResults.length > 0 ? searchResults : undefined,
                searchKeywords: collectedSearchKeywords,
                completedSearchKeywordIndex: lastCompletedKeywordIndex,
                searchConfig: interruptedState.searchConfig,
                userProfile: interruptedState.userProfile,
                discussionMode: interruptedState.discussionMode,
                discussionDepth: interruptedState.discussionDepth,
                directionGuide: interruptedState.directionGuide,
                terminationConfig: interruptedState.terminationConfig,
                interruptedAt: new Date(),
                summaryPhase: 'idle',
                startMarker: interruptedState.startMarker,
                extensionMarkers: interruptedState.extensionMarkers,
              };
              const updatedSession: DiscussionSession = {
                ...latestSession,
                interruptedTurn,
                updatedAt: new Date(),
              };
              saveSession(updatedSession).catch((saveErr) =>
                console.error('Failed to save interrupted search state:', saveErr)
              );
              setCurrentSession(updatedSession);
              setSessions((prev) =>
                prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
              );
            }
            setIsDiscussing(false);
            return;
          }
          console.error('Search failed:', err);
        } finally {
          setSearchUiProgress(null);
        }
      }

      const previousTurns = getPreviousTurns(session || currentSessionRef.current);
      const resumeSession = currentSessionRef.current;

      // 収集用のref
      const collectedMessagesRef = { current: [...interruptedState.messages] };
      const collectedFinalAnswerRef = { current: '' };
      const collectedSummaryPromptRef = { current: '' };
      const collectedSearchKeywordsRef = { current: collectedSearchKeywords };
      const currentDiscussionUiProgressRef = {
        current: {
          currentRound: interruptedState.currentRound,
          currentParticipantIndex: interruptedState.currentParticipantIndex,
        },
      };

      const context: DiscussionContext = {
        topic: interruptedState.topic,
        participants: interruptedState.participants,
        totalRounds: interruptedState.totalRounds,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        searchKeywords: collectedSearchKeywords.length > 0 ? collectedSearchKeywords : undefined,
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
            searchResults: searchResults.length > 0 ? searchResults : undefined,
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
          setDiscussionUiProgress,
          setCurrentMessages,
          setCompletedParticipants,
          setCurrentFinalAnswer,
          setCurrentSummaryPrompt,
          setSuggestedFollowUps,
          setIsGeneratingFollowUps,
          setSummaryPhase,
          setIsDiscussing,
          setSearchUiProgress,
          setCurrentSearchResults,
          setCurrentSearchKeywords,
          setError,
          setStreamingMessage,
          collectedMessagesRef,
          collectedFinalAnswerRef,
          collectedSummaryPromptRef,
          collectedSearchKeywordsRef,
          currentDiscussionUiProgressRef,
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
            currentRound: currentDiscussionUiProgressRef.current.currentRound,
            currentParticipantIndex: currentDiscussionUiProgressRef.current.currentParticipantIndex,
            totalRounds: interruptedState.totalRounds,
            searchResults: interruptedState.searchResults,
            searchKeywords: collectedSearchKeywordsRef.current.length > 0 ? collectedSearchKeywordsRef.current : undefined,
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
          setIsDiscussing(false);
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
            collectedSearchKeywordsRef.current.length > 0 ? collectedSearchKeywordsRef.current : undefined
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
        setIsDiscussing(false);
        setSearchUiProgress(null);
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

      // 現在の状態から延長用のInterruptedTurnSnapshotを構築
      const currentSession = currentSessionRef.current;
      if (!currentSession) {
        setError('セッションが見つかりません');
        return;
      }

      // 現在の議論設定を使用（フック内の状態から取得）
      // 1回目の延長で変更された設定が正しく引き継がれる
      const discussionMode: DiscussionMode = currentSettings.discussionMode || 'free';
      const discussionDepth: DiscussionDepth = currentSettings.discussionDepth || 2;
      const directionGuide: DirectionGuide = currentSettings.directionGuide || { keywords: [] };
      const terminationConfig: TerminationConfig = currentSettings.terminationConfig || { condition: 'rounds', maxRounds: 2 };

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

      // InterruptedDiscussionSnapshotを作成（マーカーを含める）
      // 検索キーワードがある場合、全て完了しているとみなす（延長時点では検索済み）
      const completedKeywordIndexForExtend = currentSearchKeywords.length > 0 && currentSearchKeywords[0].keywords.length > 0
        ? currentSearchKeywords[0].keywords.length - 1
        : undefined;
      const interruptedState: InterruptedDiscussionSnapshot = {
        sessionId: currentSession.id,
        topic: currentTopic,
        participants,
        messages: currentMessages,
        currentRound: completedRounds + 1, // 次のラウンドから開始
        currentParticipantIndex: 0,
        totalRounds: newTotalRounds,
        searchResults: currentSearchResults,
        searchKeywords: currentSearchKeywords.length > 0 ? currentSearchKeywords : undefined,
        completedSearchKeywordIndex: completedKeywordIndexForExtend,
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
        summaryPhase: 'idle',
        startMarker: startMarker || undefined,
        extensionMarkers: updatedExtensionMarkers,
      };

      // 延長マーカーを状態に追加
      setExtensionMarkers(updatedExtensionMarkers);

      // 統合回答待ち状態をリセット
      setSummaryPhase('idle');
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
      currentSettings,
    ]
  );

  // isSearchingはsearchProgressから派生
  // 注: 検索中は必ずisDiscussingもtrueなので、isProcessingには不要
  const isSearching = searchProgress !== null;

  // 処理中フラグ（議論実行中、統合回答生成中、フォローアップ生成中）
  // 検索中はisDiscussingがtrueなのでisSearchingは不要
  const isProcessing = isDiscussing || summaryPhase === 'generating' || isGeneratingFollowUps;

  return {
    currentMessages,
    currentFinalAnswer,
    currentSummaryPrompt,
    currentTopic,
    currentSearchResults,
    currentSearchKeywords,
    isDiscussing,
    isSearching,
    isGeneratingFollowUps,
    isProcessing,
    summaryPhase,
    discussionProgress,
    searchProgress,
    completedParticipants,
    suggestedFollowUps,
    error,
    messageVotes,
    discussionParticipants,
    streamingMessage,
    startMarker,
    extensionMarkers,
    currentDiscussionMode: currentSettings.discussionMode,
    currentDiscussionDepth: currentSettings.discussionDepth,
    currentDirectionGuide: currentSettings.directionGuide,
    currentTerminationConfig: currentSettings.terminationConfig,
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
