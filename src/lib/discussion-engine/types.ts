import {
  DiscussionMessage,
  DiscussionParticipant,
  PreviousTurnSummary,
  SearchResult,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  FollowUpQuestion,
  MessageVote,
} from '@/types';

/**
 * 議論の進捗情報
 */
export interface DiscussionProgress {
  type: 'message' | 'message_chunk' | 'summary' | 'error' | 'complete' | 'progress' | 'searching' | 'terminated' | 'followups' | 'ready_for_summary';
  message?: DiscussionMessage;
  messageId?: string;
  chunk?: string;
  accumulatedContent?: string;
  finalAnswer?: string;
  summaryPrompt?: string;
  error?: string;
  searchResults?: SearchResult[];
  terminationReason?: string;
  suggestedFollowUps?: FollowUpQuestion[];
  messages?: DiscussionMessage[]; // ready_for_summary時に議論メッセージを含める
  progress?: {
    currentRound: number;
    totalRounds: number;
    currentParticipantIndex: number;
    totalParticipants: number;
    currentParticipant: DiscussionParticipant;
  };
}

/**
 * 再開用のパラメータ
 */
export interface ResumeFromState {
  messages: DiscussionMessage[];
  currentRound: number;
  currentParticipantIndex: number;
}

/**
 * 議論リクエストの型定義
 */
export interface DiscussionRequest {
  topic: string;
  participants: DiscussionParticipant[];
  rounds: number;
  previousTurns?: PreviousTurnSummary[];
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
  resumeFrom?: ResumeFromState; // 中断からの再開用
  messageVotes?: MessageVote[]; // ユーザーの投票（統合回答に反映）
  skipSummary?: boolean; // 統合回答生成をスキップ（ユーザーが投票後に手動で生成）
  onMessageChunk?: OnMessageChunkCallback; // ストリーミングチャンクのコールバック
}

/**
 * ストリーミングチャンクのコールバック型
 */
export type OnMessageChunkCallback = (messageId: string, chunk: string, accumulatedContent: string, provider: string, model: string | undefined, round: number) => void;

/**
 * プロバイダーの表示名を取得
 */
export function getProviderDisplayName(type: string): string {
  const names: Record<string, string> = {
    claude: 'Claude',
    ollama: 'Ollama',
    openai: 'ChatGPT',
    gemini: 'Gemini',
  };
  return names[type] || type;
}
