'use client';

import {
  DiscussionMessage,
  DiscussionParticipant,
  FollowUpQuestion,
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
