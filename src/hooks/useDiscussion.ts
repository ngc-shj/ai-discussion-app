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
  performTimedSearch: (params: TimedSearchParams) => Promise<TimedSearchResult>;
  finalizeDiscussion: (params: FinalizeDiscussionParams) => Promise<void>;
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

export interface FinalizeDiscussionParams {
  participants: DiscussionParticipant[];
  userProfile: UserProfile;
  discussionMode: DiscussionMode;
  discussionDepth: DiscussionDepth;
  directionGuide: DirectionGuide;
  searchConfig?: SearchConfig;  // 統合前検索用
  currentSessionRef: React.RefObject<DiscussionSession | null>;
  setInterruptedState: (state: InterruptedDiscussionSnapshot | null) => void;
  updateAndSaveSession: (updates: Partial<DiscussionSession>, options?: { async?: boolean }) => Promise<void>;
}

/** 共通検索パラメータ */
export interface TimedSearchParams {
  timing: 'start' | 'round' | 'summary';
  topic: string;
  searchConfig: SearchConfig;
  participants: DiscussionParticipant[];
  messages?: DiscussionMessage[];  // summary時に議論内容を渡す
  round?: number;  // eachRound時のラウンド番号
  existingResults?: SearchResult[];  // マージ用の既存結果
  existingKeywords?: SearchKeywordInfo[];  // 復元用の既存キーワード情報
  completedKeywordIndex?: number;  // 復元時の完了インデックス
  abortSignal?: AbortSignal;  // 中断用シグナル
}

/** 共通検索結果 */
export interface TimedSearchResult {
  results: SearchResult[];
  keywordInfo: SearchKeywordInfo;
  lastCompletedKeywordIndex: number;
  wasInterrupted: boolean;
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
  searchConfig?: SearchConfig;
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
  lastSearchTimingRef?: { current: 'start' | 'round' | 'summary' | undefined };
  lastSearchRoundRef?: { current: number | undefined };
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
    lastSearchTimingRef,
    lastSearchRoundRef,
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

      // 次の位置をrefに反映（中断時の状態保存に使用）
      if (!isAllComplete) {
        currentDiscussionUiProgressRef.current = {
          currentRound: nextRound,
          currentParticipantIndex: nextParticipantIndex,
        };
      }

      const latestSession = currentSessionRef.current;
      if (latestSession) {
        // 検索キーワードと完了インデックスを決定
        const searchKeywordsForSave = collectedSearchKeywordsRef?.current?.length ? collectedSearchKeywordsRef.current : context.searchKeywords;
        const completedKeywordIndexForSave = searchKeywordsForSave && searchKeywordsForSave.length > 0 && searchKeywordsForSave[0].keywords.length > 0
          ? searchKeywordsForSave[0].keywords.length - 1  // 議論中なので検索は完了している
          : undefined;

        // 既存のsearchConfigを保持（メッセージ完了後もeachRound検索設定を維持）
        const existingSearchConfig = latestSession.interruptedTurn?.searchConfig;

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
          searchConfig: existingSearchConfig, // 検索設定を保持
          // searchTimingは設定しない（メッセージ完了時点で検索フェーズは終了）
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
    onSearching: (_searchResults, searchTiming, searchRound) => {
      // 検索開始時はキーワード生成中フェーズとして表示
      setSearchUiProgress?.({
        phase: 'keywords',
        currentKeywordIndex: 0,
        totalKeywords: 0,
        completedKeywords: [],
      });
      // 検索タイミングを記録（中断時の状態保存用）
      if (lastSearchTimingRef && searchTiming) {
        lastSearchTimingRef.current = searchTiming;
      }
      // ラウンド検索の場合、ラウンド番号も記録（progressイベントより先に来るため）
      // 注: 参加者インデックスは更新しない（既存の発言済み参加者を保持するため）
      if (searchTiming === 'round' && searchRound !== undefined) {
        if (lastSearchRoundRef) {
          lastSearchRoundRef.current = searchRound;
        }
        currentDiscussionUiProgressRef.current.currentRound = searchRound;

        // ラウンド検索開始時にセッションを即座に保存（中断→リロード対策）
        const latestSession = currentSessionRef.current;
        if (latestSession) {
          // searchConfigはcontextから取得（既存のinterruptedTurnからはフォールバック）
          const searchConfigToSave = context.searchConfig || latestSession.interruptedTurn?.searchConfig;
          const interruptedTurn: InterruptedTurnSnapshot = {
            topic: context.topic,
            participants: context.participants,
            messages: collectedMessagesRef.current,
            currentRound: searchRound,
            currentParticipantIndex: 0, // ラウンド検索中は参加者0から開始
            totalRounds: context.totalRounds,
            searchResults: context.searchResults,
            searchKeywords: collectedSearchKeywordsRef?.current,
            searchTiming: 'round',
            searchConfig: searchConfigToSave, // 検索設定を保存
            userProfile: context.userProfile,
            discussionMode: context.discussionMode,
            discussionDepth: context.discussionDepth,
            directionGuide: context.directionGuide,
            terminationConfig: context.terminationConfig,
            interruptedAt: new Date(),
            summaryPhase: 'idle',
            startMarker: context.startMarker,
            extensionMarkers: context.extensionMarkers,
          };
          const updatedSession: DiscussionSession = {
            ...latestSession,
            interruptedTurn,
            updatedAt: new Date(),
          };
          // currentSessionRefを即座に更新（中断処理で最新状態を参照するため）
          currentSessionRef.current = updatedSession;

          // localStorageにも即座に保存（リロード対策 - IndexedDBは非同期のため完了前にリロードされる可能性がある）
          const interruptedForStorage = createInterruptedState({
            sessionId: latestSession.id,
            topic: context.topic,
            participants: context.participants,
            messages: collectedMessagesRef.current,
            currentRound: searchRound,
            currentParticipantIndex: 0,
            totalRounds: context.totalRounds,
            searchResults: context.searchResults,
            searchKeywords: collectedSearchKeywordsRef?.current,
            searchTiming: 'round',
            searchConfig: searchConfigToSave,
            userProfile: context.userProfile,
            discussionMode: context.discussionMode,
            discussionDepth: context.discussionDepth,
            directionGuide: context.directionGuide,
            terminationConfig: context.terminationConfig,
            startMarker: context.startMarker,
            extensionMarkers: context.extensionMarkers,
          });
          saveInterruptedState(interruptedForStorage);

          saveSession(updatedSession).catch((err) =>
            console.error('Failed to save search state:', err)
          );
          setCurrentSession?.(updatedSession);
          setSessions((prev) =>
            prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
          );
        }
      }
    },
    onSearchResults: (searchResults, searchResultsAccumulated) => {
      setSearchUiProgress?.(null);
      // 累積結果があればそれを使用、なければこのラウンドの結果のみ
      setCurrentSearchResults?.(searchResultsAccumulated || searchResults);
      // 最後に追加されたSearchKeywordInfoに結果を紐付け（このラウンドの結果）
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
      // 最後に受信した検索タイミングを記録（中断時の状態保存用）
      if (lastSearchTimingRef) {
        lastSearchTimingRef.current = searchKeywords.timing;
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

  /**
   * 共通検索関数
   * 開始時・ラウンド・統合前 すべてで使用
   */
  const performTimedSearch = useCallback(
    async (params: TimedSearchParams): Promise<TimedSearchResult> => {
      const {
        timing,
        topic,
        searchConfig,
        participants,
        messages,
        round,
        existingResults = [],
        existingKeywords,
        completedKeywordIndex = -1,
        abortSignal,
      } = params;

      let searchKeywords: string[] = [];
      let searchResults: SearchResult[] = [...existingResults];
      let lastCompletedKeywordIndex = completedKeywordIndex;
      let keywordPrompt: string | undefined;
      let wasInterrupted = false;

      // 復元時: 既存のキーワードを使用
      const isResuming = existingKeywords && existingKeywords.length > 0 &&
        completedKeywordIndex >= 0 &&
        completedKeywordIndex < existingKeywords[0].keywords.length - 1;

      if (isResuming && existingKeywords) {
        searchKeywords = existingKeywords[0].keywords;
        keywordPrompt = existingKeywords[0].prompt;
        // 復元時の進捗表示
        const resumeFromIndex = completedKeywordIndex + 1;
        setSearchUiProgress({
          phase: 'searching',
          currentKeywordIndex: resumeFromIndex,
          totalKeywords: searchKeywords.length,
          currentKeyword: searchKeywords[resumeFromIndex],
          completedKeywords: searchKeywords.slice(0, resumeFromIndex),
          warnings: [],
        });
      } else {
        // 新規検索時: キーワードを生成
        setSearchUiProgress({
          phase: 'keywords',
          currentKeywordIndex: 0,
          totalKeywords: 0,
          completedKeywords: [],
        });

        // AIにキーワードを生成させる
        const keywordsBody: Record<string, unknown> = {
          topic,
          timing,
          participant: participants[0],
          maxKeywords: searchConfig.maxKeywords || 3,
        };
        // summary時は議論内容も渡す
        if (timing === 'summary' && messages) {
          keywordsBody.messages = messages.map(m => ({
            provider: m.displayName || `${m.provider}/${m.model}`,
            content: m.content,
          }));
        }

        const keywordsResponse = await fetch('/api/generate-search-keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keywordsBody),
          signal: abortSignal,
        });

        searchKeywords = [topic]; // フォールバック
        if (keywordsResponse.ok) {
          const keywordsData = await keywordsResponse.json();
          if (keywordsData.keywords && keywordsData.keywords.length > 0) {
            searchKeywords = keywordsData.keywords;
          }
          keywordPrompt = keywordsData.prompt;
        }

        // 進捗を更新（検索フェーズへ）
        setSearchUiProgress({
          phase: 'searching',
          currentKeywordIndex: 0,
          totalKeywords: searchKeywords.length,
          currentKeyword: searchKeywords[0],
          completedKeywords: [],
          warnings: [],
        });

        // キーワード生成直後に検索キーワード情報を設定（検索結果はundefined、後で更新）
        const earlyKeywordInfo: SearchKeywordInfo = {
          timing,
          round,
          keywords: searchKeywords,
          timestamp: new Date(),
          prompt: keywordPrompt,
          // results は undefined のまま（検索中は結果部分を表示しない）
        };
        setCurrentSearchKeywords(prev => [...prev, earlyKeywordInfo]);
      }

      // 警告を収集
      const collectedWarnings: SearchWarning[] = [];

      // 開始インデックス（復元時は途中から）
      const startIndex = isResuming ? completedKeywordIndex + 1 : 0;

      // 生成されたキーワードで検索
      for (let i = startIndex; i < searchKeywords.length; i++) {
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
            topic,
            relevanceFilter: searchConfig.relevanceFilter,
            defaultAIProvider: participants[0]?.provider,
            defaultAIModel: participants[0]?.model,
          }),
          signal: abortSignal,
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const newResults = searchData.results || [];

          // 重複除去して追加
          const resultsByUrl = new Map<string, SearchResult>();
          for (const r of searchResults) {
            resultsByUrl.set(r.url, r);
          }
          for (const r of newResults) {
            resultsByUrl.set(r.url, r);
          }
          searchResults = Array.from(resultsByUrl.values());

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

        // 完了したキーワードを更新
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
        currentKeywordIndex: searchKeywords.length - 1,
        totalKeywords: searchKeywords.length,
        completedKeywords: searchKeywords,
        warnings: collectedWarnings.length > 0 ? collectedWarnings : undefined,
      });

      // 検索結果をmaxResultsで制限
      searchResults = searchResults.slice(0, searchConfig.maxResults);

      // キーワード情報を作成
      const keywordInfo: SearchKeywordInfo = {
        timing,
        round,
        keywords: searchKeywords,
        timestamp: new Date(),
        prompt: keywordPrompt,
        results: searchResults,
      };

      // 状態を更新（既存の結果とマージ）
      const resultsByUrl = new Map<string, SearchResult>();
      for (const r of currentSearchResults) {
        resultsByUrl.set(r.url, r);
      }
      for (const r of searchResults) {
        resultsByUrl.set(r.url, r);
      }
      setCurrentSearchResults(Array.from(resultsByUrl.values()));
      // キーワード情報の結果を更新（早期追加時は空だった）
      // 復元時は既に結果がある場合もあるため、更新または追加
      setCurrentSearchKeywords(prev => {
        const existingIndex = prev.findIndex(kw => kw.timing === timing && kw.round === round);
        if (existingIndex >= 0) {
          // 既存のキーワード情報を更新
          return prev.map((kw, i) =>
            i === existingIndex ? { ...kw, results: searchResults } : kw
          );
        } else {
          // 新規追加（復元時などで早期追加されていなかった場合）
          return [...prev, keywordInfo];
        }
      });

      return {
        results: searchResults,
        keywordInfo,
        lastCompletedKeywordIndex,
        wasInterrupted,
      };
    },
    [setSearchUiProgress, currentSearchResults, setCurrentSearchResults, setCurrentSearchKeywords]
  );

  // 議論を最終化（検索→統合回答→フォローアップ）
  const finalizeDiscussion = useCallback(
    async (params: FinalizeDiscussionParams) => {
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

      // ===== ステージ0: 統合前検索 =====
      // 検索結果のkeywordInfoを保持（状態更新は非同期なので、createNewTurnに直接渡す必要がある）
      let summarySearchKeywordInfo: SearchKeywordInfo | undefined;
      if (searchConfig?.enabled && searchConfig?.timing?.beforeSummary) {
        setSummaryPhase('searching');
        setInterruptedState(null);
        try {
          const searchResult = await performTimedSearch({
            timing: 'summary',
            topic: currentTopic,
            searchConfig,
            participants,
            messages: currentMessages,
          });
          summarySearchKeywordInfo = searchResult.keywordInfo;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            setSummaryPhase('awaiting');
            return;
          }
          console.error('Summary search failed:', err);
        }
      }

      setSummaryPhase('generating');
      setError(null);
      // 復元・破棄ボタンをすぐに非表示にする
      setInterruptedState(null);

      // AbortControllerを初期化
      abortControllerRef.current = new AbortController();
      interruptRequestedRef.current = false;

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
            searchResults: currentSearchResults,
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
          // 検索キーワードを構築（状態更新は非同期なので、summarySearchKeywordInfoを直接追加）
          const allSearchKeywords = summarySearchKeywordInfo
            ? [...currentSearchKeywords, summarySearchKeywordInfo]
            : currentSearchKeywords;
          const newTurn = createNewTurn(
            currentTopic,
            currentMessages,
            collectedFinalAnswer,
            currentSearchResults.length > 0 ? currentSearchResults : undefined,
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
      const timing = searchConfig.timing || { onStart: true, beforeSummary: false, onDemand: false };
      if (searchConfig.enabled && timing.onStart) {
        try {
          const searchResult = await performTimedSearch({
            timing: 'start',
            topic,
            searchConfig,
            participants,
            abortSignal: abortControllerRef.current.signal,
          });

          searchResults = searchResult.results;
          collectedSearchKeywords = [searchResult.keywordInfo];
          setCurrentSearchResults(searchResults);
          setCurrentSearchKeywords(collectedSearchKeywords);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合：検索進捗を保存してセッションに記録
            const latestSession = currentSessionRef.current || sessionAtStart;
            if (latestSession) {
              const interruptedTurn: InterruptedTurnSnapshot = {
                topic,
                participants,
                messages: [],
                currentRound: 1,
                currentParticipantIndex: 0,
                totalRounds: terminationConfig.maxRounds,
                searchResults: searchResults.length > 0 ? searchResults : undefined,
                searchKeywords: collectedSearchKeywords,
                searchConfig,
                userProfile,
                discussionMode,
                discussionDepth,
                directionGuide,
                terminationConfig,
                interruptedAt: new Date(),
                summaryPhase: 'idle',
                startMarker: undefined,
                extensionMarkers: undefined,
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

      // 収集用のref
      const collectedMessagesRef = { current: [] as DiscussionMessage[] };
      const collectedFinalAnswerRef = { current: '' };
      const collectedSummaryPromptRef = { current: '' };
      const collectedSearchKeywordsRef = { current: collectedSearchKeywords };
      const currentDiscussionUiProgressRef = { current: { currentRound: 1, currentParticipantIndex: 0 } };
      // 最後に受信した検索タイミングを追跡（中断時の状態保存用）
      const lastSearchTimingRef = { current: undefined as 'start' | 'round' | 'summary' | undefined };
      // 最後に受信した検索ラウンドを追跡（ラウンド検索中断時の状態保存用）
      const lastSearchRoundRef = { current: undefined as number | undefined };

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
        searchConfig,
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
          lastSearchTimingRef,
          lastSearchRoundRef,
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

          // ラウンド検索中に中断した場合、正しいラウンド番号を取得
          // 優先順位: lastSearchRoundRef > 検索キーワードのround > currentDiscussionUiProgressRef
          let interruptedRound = currentDiscussionUiProgressRef.current.currentRound;
          if (lastSearchTimingRef.current === 'round') {
            // searchingイベントから直接取得したラウンド番号を優先
            if (lastSearchRoundRef.current !== undefined) {
              interruptedRound = lastSearchRoundRef.current;
            } else {
              // フォールバック: 検索キーワードから取得
              const roundKeywords = collectedSearchKeywordsRef.current.filter(kw => kw.timing === 'round');
              const lastRoundKeyword = roundKeywords.length > 0 ? roundKeywords[roundKeywords.length - 1] : undefined;
              if (lastRoundKeyword?.round) {
                interruptedRound = lastRoundKeyword.round;
              }
            }
          }

          const interrupted = createInterruptedState({
            sessionId: sessionAtStart?.id || '',
            topic,
            participants,
            messages: collectedMessagesRef.current,
            currentRound: interruptedRound,
            // 参加者インデックスは実際の進捗を保存（検索再開はsearchTimingで判断）
            currentParticipantIndex: currentDiscussionUiProgressRef.current.currentParticipantIndex,
            totalRounds: terminationConfig.maxRounds,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            searchKeywords: searchKeywordsForInterrupted.length > 0 ? searchKeywordsForInterrupted : undefined,
            completedSearchKeywordIndex: completedKeywordIndexForInterrupted,
            searchTiming: lastSearchTimingRef.current,
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

      // 統合回答待ち状態の場合は議論を再開せず、状態のみ復元
      if (interruptedState.summaryPhase === 'awaiting') {
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
        setCurrentSearchKeywords(interruptedState.searchKeywords || []);
        setDiscussionParticipants(interruptedState.participants);
        setSummaryPhase('awaiting');
        setIsDiscussing(false);
        setError(null);
        // マーカーを復元
        if (interruptedState.startMarker) {
          setStartMarker(interruptedState.startMarker);
        }
        if (interruptedState.extensionMarkers) {
          setExtensionMarkers(interruptedState.extensionMarkers);
        }
        return;
      }

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

      if (needsSearch && searchConfig) {
        console.log('[resumeDiscussion] Resuming search:', {
          hasExistingKeywords: collectedSearchKeywords.length > 0,
          totalKeywords: collectedSearchKeywords[0]?.keywords.length || 0,
          completedKeywordIndex,
          startingFromIndex: completedKeywordIndex + 1,
          existingSearchResults: searchResults.length,
        });

        try {
          const searchResult = await performTimedSearch({
            timing: 'start',
            topic: interruptedState.topic,
            searchConfig,
            participants: interruptedState.participants,
            existingResults: searchResults,
            existingKeywords: collectedSearchKeywords.length > 0 ? collectedSearchKeywords : undefined,
            completedKeywordIndex,
            abortSignal: abortControllerRef.current.signal,
          });

          searchResults = searchResult.results;
          collectedSearchKeywords = [searchResult.keywordInfo];
          setCurrentSearchResults(searchResults);
          setCurrentSearchKeywords(collectedSearchKeywords);
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // 中断された場合：検索進捗を保存してセッションに記録
            const latestSession = currentSessionRef.current;
            if (latestSession) {
              const interruptedTurn: InterruptedTurnSnapshot = {
                topic: interruptedState.topic,
                participants: interruptedState.participants,
                messages: interruptedState.messages,
                currentRound: interruptedState.currentRound,
                currentParticipantIndex: interruptedState.currentParticipantIndex,
                totalRounds: interruptedState.totalRounds,
                searchResults: searchResults.length > 0 ? searchResults : undefined,
                searchKeywords: collectedSearchKeywords,
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
      // 最後に受信した検索タイミングを追跡（中断時の状態保存用）
      const lastSearchTimingRef = { current: interruptedState.searchTiming as 'start' | 'round' | 'summary' | undefined };
      // 最後に受信した検索ラウンドを追跡（ラウンド検索中断時の状態保存用）
      const lastSearchRoundRef = { current: interruptedState.currentRound as number | undefined };

      const context: DiscussionContext = {
        topic: interruptedState.topic,
        participants: interruptedState.participants,
        totalRounds: interruptedState.totalRounds,
        searchResults: searchResults.length > 0 ? searchResults : undefined,
        searchKeywords: collectedSearchKeywords.length > 0 ? collectedSearchKeywords : undefined,
        searchConfig: interruptedState.searchConfig,
        userProfile: interruptedState.userProfile,
        discussionMode: interruptedState.discussionMode,
        discussionDepth: interruptedState.discussionDepth,
        directionGuide: interruptedState.directionGuide,
        terminationConfig: interruptedState.terminationConfig,
        startMarker: interruptedState.startMarker,
        extensionMarkers: interruptedState.extensionMarkers,
      };

      try {
        console.log('[resumeDiscussion] Calling /api/discuss with resumeFrom:', {
          currentRound: interruptedState.currentRound,
          currentParticipantIndex: interruptedState.currentParticipantIndex,
          searchTiming: interruptedState.searchTiming,
          messagesCount: interruptedState.messages.length,
        });
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
              searchTiming: interruptedState.searchTiming,
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
          lastSearchTimingRef,
          lastSearchRoundRef,
          includeReadyForSummary: true,
        });

        const wasInterrupted = await processSSEStream(
          response,
          handlers,
          () => interruptRequestedRef.current
        );

        if (wasInterrupted) {
          // ラウンド検索中に中断した場合、正しいラウンド番号を取得
          // 優先順位: lastSearchRoundRef > 検索キーワードのround > currentDiscussionUiProgressRef
          let interruptedRound = currentDiscussionUiProgressRef.current.currentRound;
          console.log('[resumeDiscussion Interrupt] Initial state:', {
            lastSearchTiming: lastSearchTimingRef.current,
            lastSearchRound: lastSearchRoundRef.current,
            currentRound: currentDiscussionUiProgressRef.current.currentRound,
            currentParticipantIndex: currentDiscussionUiProgressRef.current.currentParticipantIndex,
          });
          if (lastSearchTimingRef.current === 'round') {
            // searchingイベントから直接取得したラウンド番号を優先
            if (lastSearchRoundRef.current !== undefined) {
              interruptedRound = lastSearchRoundRef.current;
              console.log('[resumeDiscussion Interrupt] Using lastSearchRoundRef:', interruptedRound);
            } else {
              // フォールバック: 最後のラウンド検索キーワードを取得
              const roundKeywords = collectedSearchKeywordsRef.current.filter(kw => kw.timing === 'round');
              const lastRoundKeyword = roundKeywords.length > 0 ? roundKeywords[roundKeywords.length - 1] : undefined;
              if (lastRoundKeyword?.round) {
                interruptedRound = lastRoundKeyword.round;
                console.log('[resumeDiscussion Interrupt] Using roundKeyword round:', interruptedRound);
              }
            }
          }
          console.log('[resumeDiscussion Interrupt] Final interruptedRound:', interruptedRound);

          const newInterruptedState = createInterruptedState({
            sessionId: resumeSession?.id || '',
            topic: interruptedState.topic,
            participants: interruptedState.participants,
            messages: collectedMessagesRef.current,
            currentRound: interruptedRound,
            // 参加者インデックスは実際の進捗を保存（検索再開はsearchTimingで判断）
            currentParticipantIndex: currentDiscussionUiProgressRef.current.currentParticipantIndex,
            totalRounds: interruptedState.totalRounds,
            searchResults: interruptedState.searchResults,
            searchKeywords: collectedSearchKeywordsRef.current.length > 0 ? collectedSearchKeywordsRef.current : undefined,
            searchTiming: lastSearchTimingRef.current,
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

  // isSearchingはsearchProgressから派生（検索完了 phase: 'done' は検索中ではない）
  // 注: 検索中は必ずisDiscussingもtrueなので、isProcessingには不要
  const isSearching = searchProgress !== null && searchProgress.phase !== 'done';

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
    performTimedSearch,
    finalizeDiscussion,
    generateFollowUps,
  };
}
