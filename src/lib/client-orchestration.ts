'use client';

/**
 * クライアント側オーケストレーション
 *
 * 議論のループをクライアント側で制御し、各APIを順番に呼び出す。
 * 中断・再開が自然なポイントで行えるようになる。
 */

import {
  DiscussionMessage,
  DiscussionParticipant,
  SearchResult,
  SearchKeywordInfo,
  SearchConfig,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  PreviousTurnSummary,
  TerminationConfig,
} from '@/types';
import { checkConsensus, checkTerminationKeywords } from '@/lib/termination';

// ============================================================================
// 型定義
// ============================================================================

/** 議論の現在の状態 */
export interface DiscussionState {
  phase: 'idle' | 'generating_keywords' | 'searching' | 'generating' | 'awaiting' | 'summarizing' | 'followup' | 'complete' | 'error';
  currentRound: number;
  currentParticipantIndex: number;
  messages: DiscussionMessage[];
  searchResults: SearchResult[];
  searchKeywords: SearchKeywordInfo[];
  finalAnswer: string;
  summaryPrompt: string;
  suggestedFollowUps: string[];
  error: string | null;
  // 早期終了情報
  terminatedEarly?: boolean;
  terminationReason?: 'consensus' | 'keyword';
}

/** 議論設定 */
export interface DiscussionConfig {
  topic: string;
  participants: DiscussionParticipant[];
  totalRounds: number;
  searchConfig?: SearchConfig;
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  previousTurns?: PreviousTurnSummary[];
  initialSearchResults?: SearchResult[];
  terminationConfig?: TerminationConfig;
  // 再開用パラメータ
  resumeFrom?: {
    currentRound: number;
    currentParticipantIndex: number;
    messages: DiscussionMessage[];
    searchResults: SearchResult[];
    searchKeywords?: SearchKeywordInfo[];
    searchTiming?: 'start' | 'round' | 'summary';
  };
}

/** コールバック関数群 */
export interface DiscussionCallbacks {
  onStateChange: (state: DiscussionState) => void;
  onMessageChunk: (messageId: string, chunk: string, accumulatedContent: string) => void;
  onSummaryChunk: (chunk: string, accumulatedContent: string) => void;
  onSearchProgress: (keyword: string, index: number, total: number) => void;
  shouldInterrupt: () => boolean;
}

// ============================================================================
// SSEストリーム処理
// ============================================================================

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * SSEストリームを処理し、イベントごとにコールバックを呼び出す
 */
async function processSSE<T>(
  response: Response,
  onEvent: (event: SSEEvent) => T | void,
  shouldInterrupt?: () => boolean
): Promise<{ result: T | null; interrupted: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | null = null;
  let interrupted = false;

  try {
    while (true) {
      if (shouldInterrupt?.()) {
        interrupted = true;
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;
            const eventResult = onEvent(event);
            if (eventResult !== undefined) {
              result = eventResult;
            }
          } catch {
            // JSON パースエラーは無視
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { result, interrupted };
}

// ============================================================================
// API呼び出し関数
// ============================================================================

/**
 * 検索キーワードを生成
 */
export async function generateSearchKeywords(
  topic: string,
  messages: DiscussionMessage[],
  timing: 'start' | 'round' | 'summary',
  participant: DiscussionParticipant,
  maxKeywords?: number
): Promise<{ keywords: string[]; prompt?: string }> {
  const response = await fetch('/api/generate-search-keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      messages: messages.map(m => ({
        provider: m.displayName || `${m.provider}/${m.model}`,
        content: m.content,
      })),
      timing,
      provider: participant.provider,
      model: participant.model,
      maxKeywords: maxKeywords ?? 1,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate search keywords');
  }

  return response.json();
}

/**
 * 検索を実行
 */
export async function performSearch(
  query: string,
  config: SearchConfig,
  topic: string,
  timing: 'start' | 'round' | 'summary',
  searchKeywords?: string[],
  defaultAI?: { provider: string; model?: string }
): Promise<{ results: SearchResult[]; warnings?: Array<{ type: string; message: string }> }> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      topic,
      timing,
      searchKeywords,
      type: config.searchType || 'web',
      limit: config.maxResults || 5,
      language: config.language || 'ja',
      provider: config.provider,
      fetchFullContent: config.fetchFullContent,
      fullContentLimit: config.fullContentMaxResults,
      relevanceFilter: config.relevanceFilter,
      defaultAIProvider: defaultAI?.provider,
      defaultAIModel: defaultAI?.model,
    }),
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return response.json();
}

/**
 * AI発言を生成（SSEストリーミング）
 */
export async function generateAIMessage(
  config: DiscussionConfig,
  participant: DiscussionParticipant,
  round: number,
  previousMessages: DiscussionMessage[],
  searchResults: SearchResult[],
  callbacks: {
    onChunk: (messageId: string, chunk: string, accumulated: string) => void;
    shouldInterrupt: () => boolean;
  },
  enableOnDemandSearch?: boolean
): Promise<{ message: DiscussionMessage | null; interrupted: boolean; error?: string; searchQueries?: string[] }> {
  const response = await fetch('/api/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant,
      topic: config.topic,
      round,
      previousMessages,
      participants: config.participants,
      searchResults: searchResults.length > 0 ? searchResults : undefined,
      previousTurns: config.previousTurns,
      userProfile: config.userProfile,
      discussionMode: config.discussionMode,
      discussionDepth: config.discussionDepth,
      directionGuide: config.directionGuide,
      enableOnDemandSearch,
    }),
  });

  if (!response.ok) {
    throw new Error('AI generation failed');
  }

  let message: DiscussionMessage | null = null;
  let error: string | undefined;
  let searchQueries: string[] | undefined;

  const { interrupted } = await processSSE(
    response,
    (event) => {
      switch (event.type) {
        case 'message_chunk':
          callbacks.onChunk(
            event.messageId as string,
            event.chunk as string,
            event.accumulatedContent as string
          );
          break;
        case 'message':
          message = event.message as DiscussionMessage;
          searchQueries = event.searchQueries as string[] | undefined;
          break;
        case 'error':
          error = event.error as string;
          break;
      }
    },
    callbacks.shouldInterrupt
  );

  return { message, interrupted, error, searchQueries };
}

/**
 * 統合回答を生成（SSEストリーミング）
 */
export async function generateSummary(
  config: DiscussionConfig,
  messages: DiscussionMessage[],
  searchResults: SearchResult[],
  callbacks: {
    onChunk: (chunk: string, accumulated: string) => void;
    shouldInterrupt: () => boolean;
  }
): Promise<{ summary: string | null; summaryPrompt?: string; interrupted: boolean; error?: string }> {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: config.topic,
      participants: config.participants,
      messages,
      previousTurns: config.previousTurns,
      searchResults: searchResults.length > 0 ? searchResults : undefined,
      userProfile: config.userProfile,
      discussionMode: config.discussionMode,
      discussionDepth: config.discussionDepth,
      directionGuide: config.directionGuide,
    }),
  });

  if (!response.ok) {
    throw new Error('Summary generation failed');
  }

  let summary: string | null = null;
  let summaryPrompt: string | undefined;
  let error: string | undefined;

  const { interrupted } = await processSSE(
    response,
    (event) => {
      switch (event.type) {
        case 'summary_chunk':
          callbacks.onChunk(event.chunk as string, event.accumulatedContent as string);
          break;
        case 'summary':
          summary = event.finalAnswer as string;
          summaryPrompt = event.summaryPrompt as string | undefined;
          break;
        case 'error':
          error = event.error as string;
          break;
      }
    },
    callbacks.shouldInterrupt
  );

  return { summary, summaryPrompt, interrupted, error };
}

/**
 * フォローアップ質問を生成
 */
export async function generateFollowUps(
  topic: string,
  finalAnswer: string,
  participants: DiscussionParticipant[],
  userProfile?: UserProfile
): Promise<string[]> {
  const response = await fetch('/api/followups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      finalAnswer,
      participants,
      userProfile,
    }),
  });

  if (!response.ok) {
    throw new Error('Follow-up generation failed');
  }

  // SSEストリームからフォローアップを抽出
  const followUps: string[] = [];

  await processSSE(response, (event) => {
    if (event.type === 'followups') {
      const suggestions = event.suggestedFollowUps as Array<{ question: string }>;
      followUps.push(...suggestions.map(s => s.question));
    }
  });

  return followUps;
}

// ============================================================================
// 検索処理ヘルパー関数
// ============================================================================

interface ExecuteSearchParams {
  timing: 'start' | 'round';
  round?: number;
  topic: string;
  messages: DiscussionMessage[];
  participants: DiscussionParticipant[];
  searchConfig: SearchConfig;
  state: DiscussionState;
  callbacks: DiscussionCallbacks;
  updateState: (updates: Partial<DiscussionState>) => void;
}

interface ExecuteSearchResult {
  interrupted: boolean;
  searchKeywordInfo: SearchKeywordInfo | null;
}

/**
 * 検索キーワード生成と検索実行を行う共通関数
 * start/roundタイミングで使用
 */
async function executeSearchWithKeywords(
  params: ExecuteSearchParams
): Promise<ExecuteSearchResult> {
  const {
    timing,
    round,
    topic,
    messages,
    participants,
    searchConfig,
    state,
    callbacks,
    updateState,
  } = params;

  // 中断チェック
  if (callbacks.shouldInterrupt()) {
    return { interrupted: true, searchKeywordInfo: null };
  }

  // キーワード生成中
  const phaseUpdate: Partial<DiscussionState> = { phase: 'generating_keywords' };
  if (round !== undefined) {
    phaseUpdate.currentRound = round;
  }
  updateState(phaseUpdate);

  // 検索キーワードを生成
  const { keywords, prompt } = await generateSearchKeywords(
    topic,
    messages,
    timing,
    participants[0],
    searchConfig.maxKeywords
  );

  // 既存のエントリを探す
  const existingIndex = timing === 'start'
    ? state.searchKeywords.findIndex(kw => kw.timing === 'start')
    : state.searchKeywords.findIndex(kw => kw.timing === 'round' && kw.round === round);

  const keywordInfo: SearchKeywordInfo = {
    timing,
    ...(round !== undefined && { round }),
    keywords,
    prompt,
    timestamp: new Date(),
    // resultsは検索完了後に設定
  };

  if (existingIndex >= 0) {
    state.searchKeywords[existingIndex] = keywordInfo;
  } else {
    state.searchKeywords.push(keywordInfo);
  }

  // キーワード生成完了後にphase: 'searching'とキーワード情報を一緒に更新
  const searchingUpdate: Partial<DiscussionState> = {
    phase: 'searching',
    searchKeywords: [...state.searchKeywords],
  };
  if (round !== undefined) {
    searchingUpdate.currentRound = round;
  }
  updateState(searchingUpdate);

  const defaultAI = {
    provider: participants[0].provider,
    model: participants[0].model,
  };

  // 各キーワードで検索
  const uniqueNewResults: SearchResult[] = [];  // 新規結果（重複除外済み）
  let totalFetchedCount = 0;  // APIから取得した総件数（重複含む）
  for (let i = 0; i < keywords.length; i++) {
    if (callbacks.shouldInterrupt()) {
      // 中断時は完了したキーワードインデックスのみ記録
      keywordInfo.completedKeywordIndex = i - 1;
      const interruptUpdate: Partial<DiscussionState> = {
        searchResults: state.searchResults,
        searchKeywords: [...state.searchKeywords],
      };
      if (round !== undefined) {
        interruptUpdate.currentRound = round;
        interruptUpdate.messages = [...state.messages];
      }
      updateState(interruptUpdate);
      return { interrupted: true, searchKeywordInfo: keywordInfo };
    }

    callbacks.onSearchProgress(keywords[i], i, keywords.length);

    const { results: fetchedResults } = await performSearch(
      keywords[i],
      searchConfig,
      topic,
      timing,
      keywords,
      defaultAI
    );

    totalFetchedCount += fetchedResults.length;  // 取得件数をカウント

    // 重複除去してマージ
    const existingUrls = new Set(state.searchResults.map(r => r.url));
    const filteredResults = fetchedResults.filter(r => !existingUrls.has(r.url));
    state.searchResults = [...state.searchResults, ...filteredResults];
    uniqueNewResults.push(...filteredResults);
  }

  // 検索完了後にのみresultsとfetchedCountを設定
  keywordInfo.results = uniqueNewResults;
  keywordInfo.fetchedCount = totalFetchedCount;
  keywordInfo.completedKeywordIndex = keywords.length - 1;

  // searchKeywordsの状態を更新（resultsを含む）
  updateState({
    searchResults: state.searchResults,
    searchKeywords: [...state.searchKeywords],
  });

  return { interrupted: false, searchKeywordInfo: keywordInfo };
}

// ============================================================================
// メインオーケストレーション関数
// ============================================================================

/**
 * 議論を実行（クライアント側オーケストレーション）
 *
 * 中断可能なポイント:
 * - 各検索の前後
 * - 各AI発言の前後
 * - 統合回答の前後
 */
export async function runClientOrchestration(
  config: DiscussionConfig,
  callbacks: DiscussionCallbacks
): Promise<DiscussionState> {
  const { resumeFrom } = config;

  const state: DiscussionState = {
    phase: 'idle',
    currentRound: resumeFrom?.currentRound || 1,
    currentParticipantIndex: resumeFrom?.currentParticipantIndex || 0,
    messages: resumeFrom?.messages || [],
    searchResults: resumeFrom?.searchResults || config.initialSearchResults || [],
    searchKeywords: resumeFrom?.searchKeywords || [],
    finalAnswer: '',
    summaryPrompt: '',
    suggestedFollowUps: [],
    error: null,
  };

  // 再開時に searchTiming === 'summary' の場合、全ラウンド完了として awaiting フェーズから開始
  const isResumingFromSummary = resumeFrom?.searchTiming === 'summary';

  const updateState = (updates: Partial<DiscussionState>) => {
    Object.assign(state, updates);
    callbacks.onStateChange({ ...state });
  };

  try {
    // ============================================================================
    // 統合回答フェーズから再開（searchTiming === 'summary' の場合）
    // ============================================================================
    if (isResumingFromSummary) {
      // 全ラウンド完了として awaiting フェーズで停止
      // 統合回答生成は finalizeDiscussion で行う
      updateState({ phase: 'awaiting' });
      return state;
    }

    // ============================================================================
    // 開始時検索（ラウンド1、参加者0から開始する場合のみ）
    // シンプルな原則:
    // - 開始時検索キーワードがあり、検索結果がない（undefined）→ 検索から再開
    // - 開始時検索キーワードがあり、検索結果がある → 検索スキップ（AI生成へ）
    // - 開始時検索キーワードがない → 新規検索
    // ============================================================================
    const existingStartKeyword = state.searchKeywords.find(kw => kw.timing === 'start');
    const shouldRunStartSearch =
      config.searchConfig?.enabled &&
      config.searchConfig?.timing?.onStart &&
      state.currentRound === 1 &&
      state.currentParticipantIndex === 0 &&
      (!existingStartKeyword || existingStartKeyword.results === undefined);

    if (shouldRunStartSearch) {
      const { interrupted } = await executeSearchWithKeywords({
        timing: 'start',
        topic: config.topic,
        messages: [], // 開始時はメッセージなし
        participants: config.participants,
        searchConfig: config.searchConfig!,
        state,
        callbacks,
        updateState,
      });

      if (interrupted) {
        return state;
      }
    }

    // ============================================================================
    // メインループ: 各ラウンド
    // ============================================================================
    for (let round = state.currentRound; round <= config.totalRounds; round++) {
      // ラウンド検索が必要かどうか判定
      // シンプルな原則:
      // - 該当ラウンドの検索キーワードがあり、検索結果がない（undefined）→ 検索から再開
      // - 該当ラウンドの検索キーワードがあり、検索結果がある → AI生成から再開
      // - 通常時: round > 1 かつ currentParticipantIndex === 0 の場合
      const existingRoundKeyword = state.searchKeywords.find(
        kw => kw.timing === 'round' && kw.round === round
      );
      const hasKeywordsButNoResults = existingRoundKeyword && existingRoundKeyword.results === undefined;
      const shouldRunRoundSearch =
        config.searchConfig?.enabled &&
        config.searchConfig?.timing?.eachRound &&
        (hasKeywordsButNoResults || (round > 1 && state.currentParticipantIndex === 0 && !existingRoundKeyword));

      // ラウンド検索（2ラウンド目以降、または再開時）
      if (shouldRunRoundSearch) {
        // 現在のラウンドより前の全メッセージを渡す（議論の全体像を把握してキーワード生成）
        const messagesBeforeCurrentRound = state.messages.filter(m => m.round < round);

        const { interrupted } = await executeSearchWithKeywords({
          timing: 'round',
          round,
          topic: config.topic,
          messages: messagesBeforeCurrentRound.length > 0 ? messagesBeforeCurrentRound : state.messages,
          participants: config.participants,
          searchConfig: config.searchConfig!,
          state,
          callbacks,
          updateState,
        });

        if (interrupted) {
          return state;
        }
      }

      // 各参加者の発言
      const startIndex = round === state.currentRound ? state.currentParticipantIndex : 0;
      for (let pIndex = startIndex; pIndex < config.participants.length; pIndex++) {
        if (callbacks.shouldInterrupt()) {
          // 中断時は現在の状態を全て更新（searchKeywordsを含む）
          updateState({
            currentRound: round,
            currentParticipantIndex: pIndex,
            searchResults: state.searchResults,
            searchKeywords: [...state.searchKeywords],
            messages: [...state.messages],
          });
          return state;
        }

        const participant = config.participants[pIndex];
        updateState({
          phase: 'generating',
          currentRound: round,
          currentParticipantIndex: pIndex,
        });

        // onDemand検索が有効かチェック
        const enableOnDemandSearch = config.searchConfig?.enabled && config.searchConfig?.timing?.onDemand;

        const { message, interrupted, error, searchQueries } = await generateAIMessage(
          config,
          participant,
          round,
          state.messages,
          state.searchResults,
          {
            onChunk: callbacks.onMessageChunk,
            shouldInterrupt: callbacks.shouldInterrupt,
          },
          enableOnDemandSearch
        );

        if (interrupted) {
          // AI生成中に中断した場合も現在の状態を全て更新
          updateState({
            currentRound: round,
            currentParticipantIndex: pIndex,
            searchResults: state.searchResults,
            searchKeywords: [...state.searchKeywords],
            messages: [...state.messages],
          });
          return state;
        }

        if (error) {
          updateState({ phase: 'error', error });
          return state;
        }

        if (message) {
          state.messages.push(message);
          updateState({ messages: [...state.messages] });

          // ============================================================================
          // onDemand検索の実行（AIが{{SEARCH:query}}パターンで要求した場合）
          // ============================================================================
          if (searchQueries && searchQueries.length > 0 && config.searchConfig) {
            updateState({ phase: 'searching' });

            const defaultAI = {
              provider: config.participants[0].provider,
              model: config.participants[0].model,
            };

            for (let i = 0; i < searchQueries.length; i++) {
              if (callbacks.shouldInterrupt()) {
                return state;
              }

              callbacks.onSearchProgress(searchQueries[i], i, searchQueries.length);

              try {
                const { results } = await performSearch(
                  searchQueries[i],
                  config.searchConfig,
                  config.topic,
                  'round', // onDemandはラウンド中の検索として扱う
                  searchQueries,
                  defaultAI
                );

                // 重複除去してマージ
                const existingUrls = new Set(state.searchResults.map(r => r.url));
                const newResults = results.filter(r => !existingUrls.has(r.url));
                state.searchResults = [...state.searchResults, ...newResults];
              } catch (searchErr) {
                // 検索エラーは警告としてログに出すが、議論は継続
                console.warn('onDemand search failed:', searchErr);
              }
            }

            updateState({ searchResults: state.searchResults });
          }

          // ============================================================================
          // 終了条件チェック（各発言後）
          // ============================================================================
          const termConfig = config.terminationConfig;
          if (termConfig) {
            // 合意形成チェック
            if (termConfig.condition === 'consensus' && termConfig.consensusThreshold) {
              if (checkConsensus(state.messages, termConfig.consensusThreshold)) {
                updateState({
                  phase: 'awaiting',
                  terminatedEarly: true,
                  terminationReason: 'consensus',
                });
                return state;
              }
            }

            // 終了キーワードチェック
            if (termConfig.condition === 'keyword' && termConfig.terminationKeywords?.length) {
              if (checkTerminationKeywords(message.content, termConfig.terminationKeywords)) {
                updateState({
                  phase: 'awaiting',
                  terminatedEarly: true,
                  terminationReason: 'keyword',
                });
                return state;
              }
            }
          }
        }
      }

      // 次ラウンドは参加者0から
      state.currentParticipantIndex = 0;
    }

    // ============================================================================
    // 全ラウンド完了 - 統合回答待ち
    // ============================================================================
    // 統合回答生成は finalizeDiscussion で行うため、ここで awaiting フェーズで停止
    updateState({ phase: 'awaiting' });
    return state;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    updateState({ phase: 'error', error: errorMessage });
    return state;
  }
}
