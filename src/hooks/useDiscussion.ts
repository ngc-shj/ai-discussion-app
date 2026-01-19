'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
  SupportAgentConfig,
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
import {
  runClientOrchestration,
  DiscussionState as OrchestrationState,
  DiscussionConfig as OrchestrationConfig,
  DiscussionCallbacks as OrchestrationCallbacks,
} from '@/lib/client-orchestration';
import sessionEvent from '@/lib/session-event';

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
  /** 中断処理中かどうか */
  isInterrupting: boolean;
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
  supportAgent: SupportAgentConfig | null;
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
  supportAgent?: SupportAgentConfig | null;
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
  supportAgent?: SupportAgentConfig | null;
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
  supportAgent?: SupportAgentConfig | null;
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

  const [isInterrupting, setIsInterrupting] = useState(false);
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
    setIsInterrupting(false);
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

  // sessionReset/discussionClearイベントを購読して議論状態をクリア
  useEffect(() => {
    const handler = () => {
      clearCurrentTurnState();
    };
    sessionEvent.on('sessionReset', handler);
    sessionEvent.on('discussionClear', handler);
    return () => {
      sessionEvent.off('sessionReset', handler);
      sessionEvent.off('discussionClear', handler);
    };
  }, [clearCurrentTurnState]);

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
    setIsInterrupting(true);
    // AbortControllerがあればキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 中断時のUI状態をクリア（残留を防ぐ）
    setStreamingMessage(null);
    setSearchUiProgress(null);
    setIsGeneratingFollowUps(false);
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
        supportAgent,
        messages,
        round,
        existingResults = [],
        existingKeywords,
        completedKeywordIndex = -1,
        abortSignal,
      } = params;

      let searchKeywords: string[] = [];
      let accumulatedResults: SearchResult[] = [...existingResults];  // 累積結果（重複除外済み）
      let totalFetchedCount = 0;  // APIから取得した総件数（重複含む）
      let lastCompletedKeywordIndex = completedKeywordIndex;
      let keywordPrompt: string | undefined;
      let wasInterrupted = false;

      // シンプルな原則:
      // - 既存のキーワードがある → キーワード生成をスキップ、検索から開始
      // - 既存のキーワードがない → キーワード生成から開始
      const hasExistingKeywords = existingKeywords && existingKeywords.length > 0 && existingKeywords[0].keywords.length > 0;

      if (hasExistingKeywords && existingKeywords) {
        // 既存のキーワードを使用（キーワード生成済み、検索から再開）
        searchKeywords = existingKeywords[0].keywords;
        keywordPrompt = existingKeywords[0].prompt;
        // 検索開始位置を決定
        const resumeFromIndex = completedKeywordIndex >= 0 ? completedKeywordIndex + 1 : 0;
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

        // サポートエージェントまたはparticipants[0]を使用
        const keywordAgent = supportAgent
          ? { provider: supportAgent.provider, model: supportAgent.modelId }
          : participants[0];

        // AIにキーワードを生成させる
        const keywordsBody: Record<string, unknown> = {
          topic,
          timing,
          participant: keywordAgent,
          maxKeywords: searchConfig.maxKeywords || 1,
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
        // 既存のエントリがあれば更新、なければ追加（再開時の重複防止）
        setCurrentSearchKeywords(prev => {
          const existingIndex = prev.findIndex(kw => kw.timing === timing && kw.round === round);
          if (existingIndex >= 0) {
            return prev.map((kw, i) => i === existingIndex ? earlyKeywordInfo : kw);
          }
          return [...prev, earlyKeywordInfo];
        });
      }

      // 警告を収集
      const collectedWarnings: SearchWarning[] = [];

      // 開始インデックス（既存キーワードがあれば途中から）
      const startIndex = hasExistingKeywords && completedKeywordIndex >= 0 ? completedKeywordIndex + 1 : 0;

      // 生成されたキーワードで検索
      for (let i = startIndex; i < searchKeywords.length; i++) {
        const keyword = searchKeywords[i];

        // 進捗を更新
        setSearchUiProgress((prev) => prev ? {
          ...prev,
          currentKeywordIndex: i,
          currentKeyword: keyword,
        } : null);

        // 関連度評価用のAI（サポートエージェントまたはparticipants[0]）
        const relevanceAI = supportAgent
          ? { provider: supportAgent.provider, model: supportAgent.modelId }
          : { provider: participants[0]?.provider, model: participants[0]?.model };

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
            defaultAIProvider: relevanceAI.provider,
            defaultAIModel: relevanceAI.model,
          }),
          signal: abortSignal,
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const fetchedResults = searchData.results || [];  // APIから取得した結果（重複含む可能性あり）

          // 重複除去して累積結果に追加
          const resultsByUrl = new Map<string, SearchResult>();
          for (const r of accumulatedResults) {
            resultsByUrl.set(r.url, r);
          }
          for (const r of fetchedResults) {
            resultsByUrl.set(r.url, r);
          }
          accumulatedResults = Array.from(resultsByUrl.values());
          totalFetchedCount += fetchedResults.length;  // 取得件数をカウント

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
      accumulatedResults = accumulatedResults.slice(0, searchConfig.maxResults);

      // 既存の結果と重複しない新規結果のみを抽出
      const existingUrls = new Set(currentSearchResults.map((r: SearchResult) => r.url));
      const uniqueNewResults = accumulatedResults.filter((r: SearchResult) => !existingUrls.has(r.url));

      // キーワード情報を作成（新規結果のみを保存、取得件数も記録）
      const keywordInfo: SearchKeywordInfo = {
        timing,
        round,
        keywords: searchKeywords,
        timestamp: new Date(),
        prompt: keywordPrompt,
        results: uniqueNewResults,
        fetchedCount: totalFetchedCount,  // APIから取得した総件数（重複含む）
      };

      // 状態を更新（既存の結果とマージ）
      const mergedResults = [...currentSearchResults, ...uniqueNewResults];
      setCurrentSearchResults(mergedResults);
      // キーワード情報の結果を更新（早期追加時は空だった）
      // 復元時は既に結果がある場合もあるため、更新または追加
      setCurrentSearchKeywords(prev => {
        const existingIndex = prev.findIndex(kw => kw.timing === timing && kw.round === round);
        if (existingIndex >= 0) {
          // 既存のキーワード情報を更新
          return prev.map((kw, i) =>
            i === existingIndex ? { ...kw, results: uniqueNewResults } : kw
          );
        } else {
          // 新規追加（復元時などで早期追加されていなかった場合）
          return [...prev, keywordInfo];
        }
      });

      return {
        results: uniqueNewResults,
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
        supportAgent,
        currentSessionRef,
        setInterruptedState,
        updateAndSaveSession,
      } = params;

      // AbortControllerを初期化（統合前検索で使用するため、最初に初期化）
      abortControllerRef.current = new AbortController();
      interruptRequestedRef.current = false;

      // UI状態を初期化（前の状態が残らないように）
      setStreamingMessage(null);
      setSearchUiProgress(null);
      setIsGeneratingFollowUps(false);
      setIsInterrupting(false);
      setError(null);

      // ===== ステージ0: 統合前検索 =====
      // 検索結果のkeywordInfoを保持（状態更新は非同期なので、createNewTurnに直接渡す必要がある）
      let summarySearchKeywordInfo: SearchKeywordInfo | undefined;
      if (searchConfig?.enabled && searchConfig?.timing?.beforeSummary) {
        // シンプルな原則:
        // - 統合前検索キーワードがあり、検索結果がある → 検索スキップ
        // - 統合前検索キーワードがあり、検索結果がない（undefined）→ 検索から再開
        // - 統合前検索キーワードがない → 新規検索
        const existingSummaryKeyword = currentSearchKeywords.find(kw => kw.timing === 'summary');

        if (existingSummaryKeyword?.results !== undefined) {
          // 既に検索完了している → スキップ
          summarySearchKeywordInfo = existingSummaryKeyword;
        } else {
          // 検索が必要
          setSummaryPhase('searching');
          setInterruptedState(null);
          try {
            const searchResult = await performTimedSearch({
              timing: 'summary',
              topic: currentTopic,
              searchConfig,
              participants,
              supportAgent,
              messages: currentMessages,
              abortSignal: abortControllerRef.current.signal,
              // 既存のキーワードがあれば渡す（resultsはundefinedだが、キーワードは生成済み）
              existingKeywords: existingSummaryKeyword ? [existingSummaryKeyword] : undefined,
            });
            summarySearchKeywordInfo = searchResult.keywordInfo;
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              // 中断された場合、中断状態を保存
              // handleInterruptでもクリアされるが、念のため明示的にクリア
              setSearchUiProgress(null);
              const session = currentSessionRef.current;
              if (session?.interruptedTurn) {
                const updatedInterruptedTurn: InterruptedTurnSnapshot = {
                  ...session.interruptedTurn,
                  searchTiming: 'summary',
                  summaryPhase: 'awaiting',
                  interruptedAt: new Date(),
                };
                await updateAndSaveSession({
                  interruptedTurn: updatedInterruptedTurn,
                });
                const interruptedSnapshot: InterruptedDiscussionSnapshot = {
                  ...updatedInterruptedTurn,
                  sessionId: session.id,
                };
                setInterruptedState(interruptedSnapshot);
              }
              setSummaryPhase('awaiting');
              setIsInterrupting(false);
              return;
            }
            console.error('Summary search failed:', err);
          }
        }
      }

      setSummaryPhase('generating');
      setError(null);
      // 復元・破棄ボタンをすぐに非表示にする
      setInterruptedState(null);

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
        // 統合前検索の結果を含めた全検索結果を構築
        const allSearchResults = summarySearchKeywordInfo?.results
          ? [...currentSearchResults, ...summarySearchKeywordInfo.results]
          : currentSearchResults;

        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: currentTopic,
            participants,
            messages: currentMessages,
            previousTurns,
            searchResults: allSearchResults,
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
          // 中断された場合、searchTiming: 'summary'を設定して再開時に正しく処理できるようにする
          const session = currentSessionRef.current;
          if (session?.interruptedTurn) {
            // interruptedTurnにsearchTimingを設定
            const updatedInterruptedTurn: InterruptedTurnSnapshot = {
              ...session.interruptedTurn,
              searchTiming: 'summary',
              summaryPhase: 'awaiting',
              interruptedAt: new Date(),
            };
            await updateAndSaveSession({
              interruptedTurn: updatedInterruptedTurn,
            });
            // Reactの状態も更新（resumeDiscussionが正しく処理できるように）
            // InterruptedTurnSnapshotにsessionIdを追加してInterruptedDiscussionSnapshotに変換
            const interruptedSnapshot: InterruptedDiscussionSnapshot = {
              ...updatedInterruptedTurn,
              sessionId: session.id,
            };
            setInterruptedState(interruptedSnapshot);
          }
          setSummaryPhase('awaiting');
          setIsInterrupting(false);
          return;
        }

        // 統合回答が生成されたらすぐにセッションに保存
        // これにより、フォローアップ生成中に中断/リロードしても統合回答は保持される
        if (collectedFinalAnswer) {
          // 検索キーワードを構築（状態更新は非同期なので、summarySearchKeywordInfoを直接追加）
          const allSearchKeywords = summarySearchKeywordInfo
            ? [...currentSearchKeywords, summarySearchKeywordInfo]
            : currentSearchKeywords;
          // 統合前検索の結果を含めた全検索結果を構築（ターン保存用）
          const allSearchResultsForTurn = summarySearchKeywordInfo?.results
            ? [...currentSearchResults, ...summarySearchKeywordInfo.results]
            : currentSearchResults;
          const newTurn = createNewTurn(
            currentTopic,
            currentMessages,
            collectedFinalAnswer,
            allSearchResultsForTurn.length > 0 ? allSearchResultsForTurn : undefined,
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
                supportAgent,
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
          // 中断された場合、中断状態を保存してから終了
          // handleInterruptでもクリアされるが、念のため明示的にクリア
          setSearchUiProgress(null);
          setStreamingMessage(null);
          const session = currentSessionRef.current;
          if (session?.interruptedTurn) {
            const updatedInterruptedTurn: InterruptedTurnSnapshot = {
              ...session.interruptedTurn,
              searchTiming: 'summary',
              summaryPhase: 'awaiting',
              interruptedAt: new Date(),
            };
            await updateAndSaveSession({
              interruptedTurn: updatedInterruptedTurn,
            });
            const interruptedSnapshot: InterruptedDiscussionSnapshot = {
              ...updatedInterruptedTurn,
              sessionId: session.id,
            };
            setInterruptedState(interruptedSnapshot);
          }
          setSummaryPhase('awaiting');
          setIsInterrupting(false);
          return;
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        // AbortControllerをクリア
        abortControllerRef.current = null;
      }
    },
    [currentMessages, currentTopic, currentSearchResults, currentSearchKeywords, messageVotes, clearCurrentTurnState, startMarker, extensionMarkers]
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
        supportAgent,
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
            supportAgent,
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

  /**
   * 議論を開始
   * クライアント側でループを制御し、各APIを順番に呼び出す方式
   */
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
        supportAgent,
        currentSessionRef,
        setCurrentSession,
        setSessions,
        setInterruptedState,
        updateAndSaveSession,
      } = params;

      // 中断フラグ用のローカルref
      const localShouldInterruptRef = { current: false };

      // 状態をリセット
      resetAllState();
      setCurrentTopic(topic);
      setDiscussionParticipants(participants);
      setIsDiscussing(true);
      setSummaryPhase('idle');
      setError(null);

      // 設定を保存
      setCurrentSettings({
        discussionMode,
        discussionDepth,
        directionGuide,
        terminationConfig,
      });

      // 中断フラグをリセット
      abortControllerRef.current = new AbortController();

      // セッションを取得または作成
      // 追加質問の場合: 既存のセッション（currentSessionRef.current）を引き継ぐ
      // 新規の場合: 常に新しいセッションを作成（同じトピック名でも別セッション）
      let session: DiscussionSession | null = currentSessionRef.current;
      if (!session) {
        session = createNewSession(topic, participants, terminationConfig.maxRounds);
        await saveSession(session);
        setSessions((prev) => [session!, ...prev]);
      }
      setCurrentSession(session);
      currentSessionRef.current = session;

      // 開始マーカーを作成
      const turnStartMarker: StartMarker = {
        totalRounds: terminationConfig.maxRounds,
        mode: discussionMode,
        depth: discussionDepth,
        keywords: directionGuide.keywords?.length ? directionGuide.keywords : undefined,
        timestamp: new Date(),
      };
      setStartMarker(turnStartMarker);

      // オーケストレーション設定
      const orchestrationConfig: OrchestrationConfig = {
        topic,
        participants,
        totalRounds: terminationConfig.maxRounds,
        searchConfig,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide,
        supportAgent,
        previousTurns: getPreviousTurns(session),
      };

      // 前回のフェーズを記録（フェーズ変化時のみUI状態を更新するため）
      let lastPhase: OrchestrationState['phase'] | null = null;

      // コールバック
      const callbacks: OrchestrationCallbacks = {
        onStateChange: (state: OrchestrationState) => {
          // 状態更新
          setCurrentMessages(state.messages);
          setCurrentSearchResults(state.searchResults);
          setCurrentSearchKeywords(state.searchKeywords);
          setCurrentFinalAnswer(state.finalAnswer);
          setCurrentSummaryPrompt(state.summaryPrompt);
          setSuggestedFollowUps(state.suggestedFollowUps.map((q, i) => ({
            id: `followup-${i}`,
            question: q,
            category: 'expansion' as const,
          })));

          if (state.error) {
            setError(state.error);
          }

          // 進捗更新
          setDiscussionUiProgress({
            currentRound: state.currentRound,
            totalRounds: terminationConfig.maxRounds,
            currentParticipantIndex: state.currentParticipantIndex,
            totalParticipants: participants.length,
            currentParticipant: participants[state.currentParticipantIndex] || null,
          });

          // フェーズが変わった場合のみUI状態を更新
          const phaseChanged = lastPhase !== state.phase;
          lastPhase = state.phase;

          // フェーズに応じたUI状態更新（フェーズ変化時のみ）
          if (phaseChanged) {
            switch (state.phase) {
            case 'generating_keywords':
              // 検索キーワード生成中
              setStreamingMessage(null); // 前のラウンドのストリーミングメッセージをクリア
              setSearchUiProgress({
                phase: 'keywords',
                currentKeywordIndex: 0,
                totalKeywords: 0,
                completedKeywords: [],
              });
              break;
            case 'searching': {
              // 最新のキーワード情報からtotalKeywordsを取得
              const latestKeywordInfo = state.searchKeywords[state.searchKeywords.length - 1];
              const totalKeywords = latestKeywordInfo?.keywords?.length || 1;
              setStreamingMessage(null); // 前のラウンドのストリーミングメッセージをクリア
              setSearchUiProgress({
                phase: 'searching',
                currentKeywordIndex: 0,
                totalKeywords,
                completedKeywords: [],
              });
              break;
            }
            case 'generating':
              // 検索進捗をクリア
              setSearchUiProgress(null);
              // 注: 参加者情報は下のgenerating専用処理で更新
              break;
            case 'awaiting':
              // 全ラウンド完了、統合回答待ち
              setSearchUiProgress(null); // 検索進捗をクリア
              setStreamingMessage(null); // ストリーミングメッセージをクリア
              setSummaryPhase('awaiting');
              setIsDiscussing(false); // 議論中フラグをオフ
              break;
            case 'summarizing':
              setSearchUiProgress(null); // 検索進捗をクリア
              setStreamingMessage(null); // ストリーミングメッセージをクリア
              setSummaryPhase('generating');
              break;
            case 'followup':
              // フォローアップ生成中（特に状態変更なし、summaryPhaseはgeneratingのまま）
              break;
            case 'complete':
              setSearchUiProgress(null); // 検索進捗をクリア
              setStreamingMessage(null); // ストリーミングメッセージをクリア
              setSummaryPhase('idle');
              setIsDiscussing(false);
              break;
            case 'error':
              setSearchUiProgress(null); // 検索進捗をクリア
              setStreamingMessage(null); // ストリーミングメッセージをクリア
              setIsDiscussing(false);
              break;
            }
          }

          // generatingフェーズでは参加者またはラウンドが切り替わるたびにstreamingMessageを更新
          // （フェーズ変化時だけでなく、同一フェーズ内での参加者/ラウンド切り替え時も対応）
          if (state.phase === 'generating') {
            const currentParticipant = participants[state.currentParticipantIndex];
            setStreamingMessage((prev) => {
              // 参加者またはラウンドが変わった場合は新しいstreamingMessageを作成
              if (prev?.participantId !== currentParticipant?.id || prev?.round !== state.currentRound) {
                return {
                  messageId: '',
                  participantId: currentParticipant?.id || '',
                  content: '',
                  provider: currentParticipant?.provider || '',
                  round: state.currentRound,
                };
              }
              // 参加者もラウンドも同じ場合は更新不要
              return prev;
            });
          }

          // 状態保存のロジック
          // シンプルな原則: フェーズ変化時に保存（中断ボタン押下時の特別な保存は不要）
          // - フェーズ変化時: 現在の状態を保存
          // - complete/error/idle: 正常終了または開始前なので保存不要
          // 中断時は直前の保存済み状態から再開すればよい
          if (phaseChanged && state.phase !== 'complete' && state.phase !== 'error' && state.phase !== 'idle') {
            // フェーズに応じたsearchTimingとsummaryPhaseを決定
            let searchTiming: 'start' | 'round' | 'summary' | undefined;
            let summaryPhase: 'awaiting' | 'searching' | 'generating' | 'idle' | undefined;

            if (state.phase === 'awaiting') {
              summaryPhase = 'awaiting';
            } else if (state.phase === 'summarizing') {
              searchTiming = 'summary';
              summaryPhase = 'generating';
            } else if (state.phase === 'generating_keywords' || state.phase === 'searching') {
              const latestKeywordInfo = state.searchKeywords[state.searchKeywords.length - 1];
              searchTiming = latestKeywordInfo?.timing;
            }

            const interrupted = createInterruptedState({
              sessionId: session?.id || '',
              topic,
              participants,
              messages: state.messages,
              currentRound: state.currentRound,
              currentParticipantIndex: state.currentParticipantIndex,
              totalRounds: terminationConfig.maxRounds,
              searchResults: state.searchResults,
              searchKeywords: state.searchKeywords,
              searchTiming,
              searchConfig,
              userProfile,
              discussionMode,
              discussionDepth,
              directionGuide,
              terminationConfig,
              startMarker: turnStartMarker,
              summaryPhase,
            });
            saveInterruptedState(interrupted);
            setInterruptedState(interrupted);
          }
        },
        onMessageChunk: (messageId, _chunk, accumulatedContent) => {
          // stateから現在のラウンドと参加者を取得
          setStreamingMessage((prev) => ({
            messageId,
            participantId: prev?.participantId || '',
            content: accumulatedContent,
            provider: prev?.provider || '',
            round: prev?.round || 1,
          }));
        },
        onSummaryChunk: (_chunk, accumulatedContent) => {
          setCurrentFinalAnswer(accumulatedContent);
        },
        onSearchProgress: (keyword, index, total) => {
          setSearchUiProgress({
            phase: 'searching',
            currentKeywordIndex: index,
            totalKeywords: total,
            currentKeyword: keyword,
            completedKeywords: [],
          });
        },
        shouldInterrupt: () => localShouldInterruptRef.current,
      };

      // 中断ハンドラを設定（abortControllerのabortイベントで中断フラグを立てる）
      abortControllerRef.current.signal.addEventListener('abort', () => {
        localShouldInterruptRef.current = true;
      });

      try {
        // オーケストレーション実行
        const finalState = await runClientOrchestration(orchestrationConfig, callbacks);

        // 中断された場合
        if (localShouldInterruptRef.current) {
          // 中断状態の保存は onStateChange 内で既に行われている
          setIsDiscussing(false);
          setIsInterrupting(false);
          setStreamingMessage(null);
          setSearchUiProgress(null);
          return;
        }

        // 完了時の処理（awaitingで停止した場合も含む）
        if (finalState.phase === 'complete' && finalState.finalAnswer) {
          // ターンを保存
          const newTurn = createNewTurn(
            topic,
            finalState.messages,
            finalState.finalAnswer,
            finalState.searchResults,
            finalState.summaryPrompt,
            undefined, // suggestedFollowUps
            turnStartMarker,
            undefined, // extensionMarkers
            finalState.searchKeywords
          );

          await updateAndSaveSession({
            turns: [...(session?.turns || []), newTurn],
            interruptedTurn: undefined,
          });

          // 中断状態をクリア
          clearInterruptedState();
          setInterruptedState(null);
        }

        setStreamingMessage(null);
        setSearchUiProgress(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsDiscussing(false);
      }
    },
    [
      resetAllState,
      setCurrentTopic,
      setDiscussionParticipants,
      setIsDiscussing,
      setSummaryPhase,
      setError,
      setCurrentSettings,
      setCurrentMessages,
      setCurrentSearchResults,
      setCurrentSearchKeywords,
      setCurrentFinalAnswer,
      setCurrentSummaryPrompt,
      setSuggestedFollowUps,
      setDiscussionUiProgress,
      setSearchUiProgress,
      setStreamingMessage,
      setStartMarker,
    ]
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

      // 中断フラグ用のローカルref
      const localShouldInterruptRef = { current: false };

      // 再開開始時に中断状態をクリア（再度中断した場合は新しい状態が保存される）
      clearInterruptedState();
      setInterruptedState(null);

      // 状態を復元
      restoreFromSession({
        participants: interruptedState.participants,
        discussionMode: interruptedState.discussionMode,
        discussionDepth: interruptedState.discussionDepth,
        directionGuide: interruptedState.directionGuide,
        terminationConfig: interruptedState.terminationConfig,
        userProfile: interruptedState.userProfile,
      });
      setCurrentMessages(interruptedState.messages);
      setCurrentSearchResults(interruptedState.searchResults || []);
      // 検索キーワードを復元（未完了の検索結果はundefinedにリセット）
      const cleanedSearchKeywords = (interruptedState.searchKeywords || []).map(kw => {
        // searchTiming === 'round' で再開する場合、該当ラウンドの検索キーワードのresultsをundefinedに
        // （検索が再実行されるため、古い結果を表示しない）
        if (interruptedState.searchTiming === 'round' && kw.timing === 'round' && kw.round === interruptedState.currentRound) {
          return { ...kw, results: undefined };
        }
        // searchTiming === 'start' で再開する場合、開始時検索のresultsをundefinedに
        if (interruptedState.searchTiming === 'start' && kw.timing === 'start') {
          return { ...kw, results: undefined };
        }
        // completedKeywordIndexがキーワード数未満の場合、検索が未完了なのでresultsをundefinedに
        if (kw.completedKeywordIndex !== undefined && kw.completedKeywordIndex < kw.keywords.length - 1) {
          return { ...kw, results: undefined };
        }
        return kw;
      });
      setCurrentSearchKeywords(cleanedSearchKeywords);
      setCurrentTopic(interruptedState.topic);
      setDiscussionParticipants(interruptedState.participants);
      setIsDiscussing(true);
      setSummaryPhase('idle');
      setError(null);
      // UI状態を初期化（前の状態が残らないように）
      setSearchUiProgress(null);
      setStreamingMessage(null);
      setIsGeneratingFollowUps(false);
      setIsInterrupting(false);

      // 設定を復元
      setCurrentSettings({
        discussionMode: interruptedState.discussionMode || null,
        discussionDepth: interruptedState.discussionDepth || null,
        directionGuide: interruptedState.directionGuide || null,
        terminationConfig: interruptedState.terminationConfig || null,
      });

      // 開始マーカーを復元
      if (interruptedState.startMarker) {
        setStartMarker(interruptedState.startMarker);
      }

      // 中断フラグをリセット
      abortControllerRef.current = new AbortController();

      // セッションを取得または作成
      const sessions = await getAllSessions();
      let session = sessions.find((s) => s.id === interruptedState.sessionId);
      if (!session) {
        session = createNewSession(
          interruptedState.topic,
          interruptedState.participants,
          interruptedState.totalRounds
        );
        await saveSession(session);
        setSessions((prev) => [session!, ...prev]);
      }
      setCurrentSession(session);
      currentSessionRef.current = session;

      // 開始マーカー（再開時は中断状態から復元）
      const turnStartMarker: StartMarker | undefined = interruptedState.startMarker || (
        interruptedState.discussionMode && interruptedState.discussionDepth
          ? {
            totalRounds: interruptedState.totalRounds,
            mode: interruptedState.discussionMode,
            depth: interruptedState.discussionDepth,
            keywords: interruptedState.directionGuide?.keywords?.length
              ? interruptedState.directionGuide.keywords
              : undefined,
            timestamp: new Date(),
          }
          : undefined
      );

      // オーケストレーション設定（再開用）
      const orchestrationConfig: OrchestrationConfig = {
        topic: interruptedState.topic,
        participants: interruptedState.participants,
        totalRounds: interruptedState.totalRounds,
        searchConfig: interruptedState.searchConfig,
        userProfile: interruptedState.userProfile,
        discussionMode: interruptedState.discussionMode,
        discussionDepth: interruptedState.discussionDepth,
        directionGuide: interruptedState.directionGuide,
        previousTurns: getPreviousTurns(session),
        // 再開用パラメータ
        resumeFrom: {
          currentRound: interruptedState.currentRound,
          currentParticipantIndex: interruptedState.currentParticipantIndex,
          messages: interruptedState.messages,
          searchResults: interruptedState.searchResults || [],
          searchKeywords: interruptedState.searchKeywords,
          searchTiming: interruptedState.searchTiming,
        },
      };

      // 前回のフェーズを記録
      let lastPhase: OrchestrationState['phase'] | null = null;

      // コールバック（startDiscussionと同様）
      const callbacks: OrchestrationCallbacks = {
        onStateChange: (state: OrchestrationState) => {
          // 状態更新
          setCurrentMessages(state.messages);
          setCurrentSearchResults(state.searchResults);
          setCurrentSearchKeywords(state.searchKeywords);
          setCurrentFinalAnswer(state.finalAnswer);
          setCurrentSummaryPrompt(state.summaryPrompt);
          setSuggestedFollowUps(state.suggestedFollowUps.map((q, i) => ({
            id: `followup-${i}`,
            question: q,
            category: 'expansion' as const,
          })));

          if (state.error) {
            setError(state.error);
          }

          // 進捗更新
          setDiscussionUiProgress({
            currentRound: state.currentRound,
            totalRounds: interruptedState.totalRounds,
            currentParticipantIndex: state.currentParticipantIndex,
            totalParticipants: interruptedState.participants.length,
            currentParticipant: interruptedState.participants[state.currentParticipantIndex] || null,
          });

          // フェーズが変わった場合のみUI状態を更新
          const phaseChanged = lastPhase !== state.phase;
          lastPhase = state.phase;

          if (phaseChanged) {
            switch (state.phase) {
            case 'generating_keywords':
              setStreamingMessage(null);
              setSearchUiProgress({
                phase: 'keywords',
                currentKeywordIndex: 0,
                totalKeywords: 0,
                completedKeywords: [],
              });
              break;
            case 'searching': {
              const latestKeywordInfo = state.searchKeywords[state.searchKeywords.length - 1];
              const totalKeywords = latestKeywordInfo?.keywords?.length || 1;
              setStreamingMessage(null);
              setSearchUiProgress({
                phase: 'searching',
                currentKeywordIndex: 0,
                totalKeywords,
                completedKeywords: [],
              });
              break;
            }
            case 'generating':
              // 検索進捗をクリア
              setSearchUiProgress(null);
              // 注: 参加者情報は下のgenerating専用処理で更新
              break;
            case 'awaiting':
              setSearchUiProgress(null);
              setStreamingMessage(null);
              setSummaryPhase('awaiting');
              setIsDiscussing(false);
              break;
            case 'summarizing':
              setSearchUiProgress(null);
              setStreamingMessage(null);
              setSummaryPhase('generating');
              break;
            case 'followup':
              break;
            case 'complete':
              setSearchUiProgress(null);
              setStreamingMessage(null);
              setSummaryPhase('idle');
              setIsDiscussing(false);
              break;
            case 'error':
              setSearchUiProgress(null);
              setStreamingMessage(null);
              setIsDiscussing(false);
              break;
            }
          }

          // generatingフェーズでは参加者またはラウンドが切り替わるたびにstreamingMessageを更新
          // （フェーズ変化時だけでなく、同一フェーズ内での参加者/ラウンド切り替え時も対応）
          if (state.phase === 'generating') {
            const currentParticipant = interruptedState.participants[state.currentParticipantIndex];
            setStreamingMessage((prev) => {
              // 参加者またはラウンドが変わった場合は新しいstreamingMessageを作成
              if (prev?.participantId !== currentParticipant?.id || prev?.round !== state.currentRound) {
                return {
                  messageId: '',
                  participantId: currentParticipant?.id || '',
                  content: '',
                  provider: currentParticipant?.provider || '',
                  round: state.currentRound,
                };
              }
              // 参加者もラウンドも同じ場合は更新不要
              return prev;
            });
          }

          // 状態保存のロジック
          // シンプルな原則: フェーズ変化時に保存（中断ボタン押下時の特別な保存は不要）
          // - フェーズ変化時: 現在の状態を保存
          // - complete/error/idle: 正常終了または開始前なので保存不要
          // 中断時は直前の保存済み状態から再開すればよい
          if (phaseChanged && state.phase !== 'complete' && state.phase !== 'error' && state.phase !== 'idle') {
            // フェーズに応じたsearchTimingとsummaryPhaseを決定
            let searchTiming: 'start' | 'round' | 'summary' | undefined;
            let summaryPhase: 'awaiting' | 'searching' | 'generating' | 'idle' | undefined;

            if (state.phase === 'awaiting') {
              summaryPhase = 'awaiting';
            } else if (state.phase === 'summarizing') {
              searchTiming = 'summary';
              summaryPhase = 'generating';
            } else if (state.phase === 'generating_keywords' || state.phase === 'searching') {
              const latestKeywordInfo = state.searchKeywords[state.searchKeywords.length - 1];
              searchTiming = latestKeywordInfo?.timing;
            }

            const interrupted = createInterruptedState({
              sessionId: session?.id || '',
              topic: interruptedState.topic,
              participants: interruptedState.participants,
              messages: state.messages,
              currentRound: state.currentRound,
              currentParticipantIndex: state.currentParticipantIndex,
              totalRounds: interruptedState.totalRounds,
              searchResults: state.searchResults,
              searchKeywords: state.searchKeywords,
              searchTiming,
              searchConfig: interruptedState.searchConfig,
              userProfile: interruptedState.userProfile,
              discussionMode: interruptedState.discussionMode,
              discussionDepth: interruptedState.discussionDepth,
              directionGuide: interruptedState.directionGuide,
              terminationConfig: interruptedState.terminationConfig,
              startMarker: turnStartMarker,
              summaryPhase,
            });
            saveInterruptedState(interrupted);
            setInterruptedState(interrupted);
          }
        },
        onMessageChunk: (messageId, _chunk, accumulatedContent) => {
          setStreamingMessage((prev) => ({
            messageId,
            participantId: prev?.participantId || '',
            content: accumulatedContent,
            provider: prev?.provider || '',
            round: prev?.round || 1,
          }));
        },
        onSummaryChunk: (_chunk, accumulatedContent) => {
          setCurrentFinalAnswer(accumulatedContent);
        },
        onSearchProgress: (keyword, index, total) => {
          setSearchUiProgress({
            phase: 'searching',
            currentKeywordIndex: index,
            totalKeywords: total,
            currentKeyword: keyword,
            completedKeywords: [],
          });
        },
        shouldInterrupt: () => localShouldInterruptRef.current,
      };

      // 中断ハンドラを設定
      abortControllerRef.current.signal.addEventListener('abort', () => {
        localShouldInterruptRef.current = true;
      });

      try {
        // オーケストレーション実行
        const finalState = await runClientOrchestration(orchestrationConfig, callbacks);

        // 中断された場合
        if (localShouldInterruptRef.current) {
          setIsDiscussing(false);
          setIsInterrupting(false);
          setStreamingMessage(null);
          setSearchUiProgress(null);
          return;
        }

        // 完了時の処理（completeフェーズでターン保存）
        if (finalState.phase === 'complete' && finalState.finalAnswer) {
          const newTurn = createNewTurn(
            interruptedState.topic,
            finalState.messages,
            finalState.finalAnswer,
            finalState.searchResults,
            finalState.summaryPrompt,
            undefined,
            turnStartMarker,
            undefined,
            finalState.searchKeywords
          );

          await updateAndSaveSession({
            turns: [...(session?.turns || []), newTurn],
            interruptedTurn: undefined,
          });
        }
        // 注: 中断状態は再開開始時にクリア済み

        setStreamingMessage(null);
        setSearchUiProgress(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsDiscussing(false);
      }
    },
    [
      setCurrentTopic,
      setDiscussionParticipants,
      setIsDiscussing,
      setSummaryPhase,
      setError,
      setCurrentSettings,
      setCurrentMessages,
      setCurrentSearchResults,
      setCurrentSearchKeywords,
      setCurrentFinalAnswer,
      setCurrentSummaryPrompt,
      setSuggestedFollowUps,
      setDiscussionUiProgress,
      setSearchUiProgress,
      setStreamingMessage,
      setStartMarker,
    ]
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
      currentSearchKeywords,
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
    isInterrupting,
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
