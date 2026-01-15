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
  formatParticipantDisplayName,
} from '@/types';

// ============================================================================
// 型定義
// ============================================================================

/** 議論の現在の状態 */
export interface DiscussionState {
  phase: 'idle' | 'searching' | 'generating' | 'summarizing' | 'followup' | 'complete' | 'error';
  currentRound: number;
  currentParticipantIndex: number;
  messages: DiscussionMessage[];
  searchResults: SearchResult[];
  searchKeywords: SearchKeywordInfo[];
  finalAnswer: string;
  summaryPrompt: string;
  suggestedFollowUps: string[];
  error: string | null;
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
  participant: DiscussionParticipant
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
  }
): Promise<{ message: DiscussionMessage | null; interrupted: boolean; error?: string }> {
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
    }),
  });

  if (!response.ok) {
    throw new Error('AI generation failed');
  }

  let message: DiscussionMessage | null = null;
  let error: string | undefined;

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
          break;
        case 'error':
          error = event.error as string;
          break;
      }
    },
    callbacks.shouldInterrupt
  );

  return { message, interrupted, error };
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
  callbacks: DiscussionCallbacks,
  resumeFrom?: {
    round: number;
    participantIndex: number;
    messages: DiscussionMessage[];
    searchResults: SearchResult[];
    searchKeywords: SearchKeywordInfo[];
  }
): Promise<DiscussionState> {
  const state: DiscussionState = {
    phase: 'idle',
    currentRound: resumeFrom?.round || 1,
    currentParticipantIndex: resumeFrom?.participantIndex || 0,
    messages: resumeFrom?.messages || [],
    searchResults: resumeFrom?.searchResults || config.initialSearchResults || [],
    searchKeywords: resumeFrom?.searchKeywords || [],
    finalAnswer: '',
    summaryPrompt: '',
    suggestedFollowUps: [],
    error: null,
  };

  const updateState = (updates: Partial<DiscussionState>) => {
    Object.assign(state, updates);
    callbacks.onStateChange({ ...state });
  };

  try {
    // ============================================================================
    // 開始時検索（ラウンド1、参加者0から開始する場合のみ）
    // ============================================================================
    if (
      config.searchConfig?.enabled &&
      config.searchConfig?.timing?.onStart &&
      state.currentRound === 1 &&
      state.currentParticipantIndex === 0 &&
      state.searchResults.length === 0
    ) {
      if (callbacks.shouldInterrupt()) {
        return state;
      }

      updateState({ phase: 'searching' });

      const defaultAI = {
        provider: config.participants[0].provider,
        model: config.participants[0].model,
      };

      const { results } = await performSearch(
        config.topic,
        config.searchConfig,
        config.topic,
        'start',
        undefined,
        defaultAI
      );

      state.searchResults = results;
      updateState({ searchResults: results });
    }

    // ============================================================================
    // メインループ: 各ラウンド
    // ============================================================================
    for (let round = state.currentRound; round <= config.totalRounds; round++) {
      // ラウンド検索（2ラウンド目以降、または再開時）
      if (
        config.searchConfig?.enabled &&
        config.searchConfig?.timing?.eachRound &&
        round > 1 &&
        state.currentParticipantIndex === 0
      ) {
        if (callbacks.shouldInterrupt()) {
          updateState({ currentRound: round });
          return state;
        }

        updateState({ phase: 'searching', currentRound: round });

        // 前ラウンドのメッセージからキーワード生成
        const previousRoundMessages = state.messages.filter(m => m.round === round - 1);
        const { keywords, prompt } = await generateSearchKeywords(
          config.topic,
          previousRoundMessages.length > 0 ? previousRoundMessages : state.messages,
          'round',
          config.participants[0]
        );

        const keywordInfo: SearchKeywordInfo = {
          timing: 'round',
          round,
          keywords,
          prompt,
          timestamp: new Date(),
        };
        state.searchKeywords.push(keywordInfo);
        updateState({ searchKeywords: [...state.searchKeywords] });

        // 各キーワードで検索
        const defaultAI = {
          provider: config.participants[0].provider,
          model: config.participants[0].model,
        };

        for (let i = 0; i < keywords.length; i++) {
          if (callbacks.shouldInterrupt()) {
            updateState({ currentRound: round });
            return state;
          }

          callbacks.onSearchProgress(keywords[i], i, keywords.length);

          const { results } = await performSearch(
            keywords[i],
            config.searchConfig,
            config.topic,
            'round',
            keywords,
            defaultAI
          );

          // 重複除去してマージ
          const existingUrls = new Set(state.searchResults.map(r => r.url));
          const newResults = results.filter(r => !existingUrls.has(r.url));
          state.searchResults = [...state.searchResults, ...newResults];
        }

        updateState({ searchResults: state.searchResults });
      }

      // 各参加者の発言
      const startIndex = round === state.currentRound ? state.currentParticipantIndex : 0;
      for (let pIndex = startIndex; pIndex < config.participants.length; pIndex++) {
        if (callbacks.shouldInterrupt()) {
          updateState({ currentRound: round, currentParticipantIndex: pIndex });
          return state;
        }

        const participant = config.participants[pIndex];
        updateState({
          phase: 'generating',
          currentRound: round,
          currentParticipantIndex: pIndex,
        });

        const { message, interrupted, error } = await generateAIMessage(
          config,
          participant,
          round,
          state.messages,
          state.searchResults,
          {
            onChunk: callbacks.onMessageChunk,
            shouldInterrupt: callbacks.shouldInterrupt,
          }
        );

        if (interrupted) {
          updateState({ currentRound: round, currentParticipantIndex: pIndex });
          return state;
        }

        if (error) {
          updateState({ phase: 'error', error });
          return state;
        }

        if (message) {
          state.messages.push(message);
          updateState({ messages: [...state.messages] });
        }
      }

      // 次ラウンドは参加者0から
      state.currentParticipantIndex = 0;
    }

    // ============================================================================
    // 統合前検索
    // ============================================================================
    if (config.searchConfig?.enabled && config.searchConfig?.timing?.beforeSummary) {
      if (callbacks.shouldInterrupt()) {
        return state;
      }

      updateState({ phase: 'searching' });

      const { keywords, prompt } = await generateSearchKeywords(
        config.topic,
        state.messages,
        'summary',
        config.participants[0]
      );

      const keywordInfo: SearchKeywordInfo = {
        timing: 'summary',
        keywords,
        prompt,
        timestamp: new Date(),
      };
      state.searchKeywords.push(keywordInfo);
      updateState({ searchKeywords: [...state.searchKeywords] });

      const defaultAI = {
        provider: config.participants[0].provider,
        model: config.participants[0].model,
      };

      for (let i = 0; i < keywords.length; i++) {
        if (callbacks.shouldInterrupt()) {
          return state;
        }

        callbacks.onSearchProgress(keywords[i], i, keywords.length);

        const { results } = await performSearch(
          keywords[i],
          config.searchConfig,
          config.topic,
          'summary',
          keywords,
          defaultAI
        );

        const existingUrls = new Set(state.searchResults.map(r => r.url));
        const newResults = results.filter(r => !existingUrls.has(r.url));
        state.searchResults = [...state.searchResults, ...newResults];
      }

      updateState({ searchResults: state.searchResults });
    }

    // ============================================================================
    // 統合回答生成
    // ============================================================================
    if (callbacks.shouldInterrupt()) {
      return state;
    }

    updateState({ phase: 'summarizing' });

    const { summary, summaryPrompt, interrupted, error } = await generateSummary(
      config,
      state.messages,
      state.searchResults,
      {
        onChunk: callbacks.onSummaryChunk,
        shouldInterrupt: callbacks.shouldInterrupt,
      }
    );

    if (interrupted) {
      return state;
    }

    if (error) {
      updateState({ phase: 'error', error });
      return state;
    }

    if (summary) {
      state.finalAnswer = summary;
      state.summaryPrompt = summaryPrompt || '';
      updateState({ finalAnswer: summary, summaryPrompt: summaryPrompt || '' });
    }

    // ============================================================================
    // フォローアップ質問生成
    // ============================================================================
    if (state.finalAnswer) {
      updateState({ phase: 'followup' });

      try {
        const followUps = await generateFollowUps(
          config.topic,
          state.finalAnswer,
          config.participants,
          config.userProfile
        );

        state.suggestedFollowUps = followUps;
        updateState({ suggestedFollowUps: followUps });
      } catch {
        // フォローアップ生成の失敗は無視
      }
    }

    // ============================================================================
    // 完了
    // ============================================================================
    updateState({ phase: 'complete' });
    return state;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    updateState({ phase: 'error', error: errorMessage });
    return state;
  }
}
