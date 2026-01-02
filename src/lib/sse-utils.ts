'use client';

import {
  DiscussionMessage,
  DiscussionParticipant,
  DiscussionSession,
  FollowUpQuestion,
  InterruptedDiscussionState,
  PreviousTurnSummary,
  SearchResult,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
} from '@/types';

// SSEイベントの型定義
export interface SSEProgressEvent {
  type: 'progress';
  progress: {
    currentRound: number;
    totalRounds: number;
    currentParticipantIndex: number;
    totalParticipants: number;
    currentParticipant: DiscussionParticipant | null;
    isSummarizing: boolean;
  };
}

export interface SSEMessageEvent {
  type: 'message';
  message: DiscussionMessage;
}

export interface SSESummaryEvent {
  type: 'summary';
  finalAnswer: string;
  summaryPrompt?: string;
}

export interface SSEFollowupsEvent {
  type: 'followups';
  suggestedFollowUps: FollowUpQuestion[];
}

export interface SSEErrorEvent {
  type: 'error';
  error: string;
}

export interface SSEReadyForSummaryEvent {
  type: 'ready_for_summary';
}

export interface SSECompleteEvent {
  type: 'complete';
}

export type SSEEvent =
  | SSEProgressEvent
  | SSEMessageEvent
  | SSESummaryEvent
  | SSEFollowupsEvent
  | SSEErrorEvent
  | SSEReadyForSummaryEvent
  | SSECompleteEvent;

// イベントハンドラのインターフェース
export interface SSEEventHandlers {
  onProgress?: (progress: SSEProgressEvent['progress']) => void;
  onMessage?: (message: DiscussionMessage) => void;
  onSummary?: (finalAnswer: string, summaryPrompt?: string) => void;
  onFollowups?: (followups: FollowUpQuestion[]) => void;
  onError?: (error: string) => void;
  onReadyForSummary?: () => void;
  onComplete?: () => void;
}

/**
 * SSE行をパースしてイベントハンドラを呼び出す
 */
export function parseSSELine(line: string, handlers: SSEEventHandlers): void {
  if (!line.startsWith('data: ')) return;

  const data = line.slice(6);
  try {
    const event = JSON.parse(data) as SSEEvent;

    switch (event.type) {
      case 'progress':
        handlers.onProgress?.(event.progress);
        break;
      case 'message':
        handlers.onMessage?.(event.message);
        break;
      case 'summary':
        handlers.onSummary?.(event.finalAnswer, event.summaryPrompt);
        break;
      case 'followups':
        handlers.onFollowups?.(event.suggestedFollowUps);
        break;
      case 'error':
        handlers.onError?.(event.error);
        break;
      case 'ready_for_summary':
        handlers.onReadyForSummary?.();
        break;
      case 'complete':
        handlers.onComplete?.();
        break;
    }
  } catch {
    // JSON parse error, ignore
  }
}

/**
 * SSEストリームを読み取り、イベントハンドラを呼び出す
 * @param response fetchレスポンス
 * @param handlers イベントハンドラ
 * @param shouldInterrupt 中断判定関数（オプション）
 * @returns 中断された場合はtrue
 */
export async function processSSEStream(
  response: Response,
  handlers: SSEEventHandlers,
  shouldInterrupt?: () => boolean
): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let wasInterrupted = false;

  try {
    while (true) {
      // 中断チェック
      if (shouldInterrupt?.()) {
        wasInterrupted = true;
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        // ストリーム終了時にバッファに残っているデータを処理
        if (buffer.trim()) {
          const remainingLines = buffer.split('\n\n');
          for (const line of remainingLines) {
            parseSSELine(line, handlers);
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        parseSSELine(line, handlers);
      }
    }
  } finally {
    // リーダーを確実にクリーンアップ
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }

  return wasInterrupted;
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * InterruptedDiscussionState を作成するためのパラメータ
 */
export interface CreateInterruptedStateParams {
  sessionId: string;
  topic: string;
  participants: DiscussionParticipant[];
  messages: DiscussionMessage[];
  currentRound: number;
  currentParticipantIndex: number;
  totalRounds: number;
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
}

/**
 * InterruptedDiscussionState オブジェクトを作成
 * 中断時の状態保存で使用する共通ヘルパー
 */
export function createInterruptedState(
  params: CreateInterruptedStateParams
): InterruptedDiscussionState {
  return {
    sessionId: params.sessionId,
    topic: params.topic,
    participants: params.participants,
    messages: params.messages,
    currentRound: params.currentRound,
    currentParticipantIndex: params.currentParticipantIndex,
    totalRounds: params.totalRounds,
    searchResults: params.searchResults,
    userProfile: params.userProfile,
    discussionMode: params.discussionMode,
    discussionDepth: params.discussionDepth,
    directionGuide: params.directionGuide,
    terminationConfig: params.terminationConfig,
    interruptedAt: new Date(),
  };
}

/**
 * セッションから過去のターンの要約リストを取得
 * 議論継続時のコンテキスト提供用
 */
export function getPreviousTurns(
  session: DiscussionSession | null | undefined
): PreviousTurnSummary[] {
  if (!session?.turns) return [];
  return session.turns.map((t) => ({
    topic: t.topic,
    finalAnswer: t.finalAnswer,
  }));
}
