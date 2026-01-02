import { AIProviderType } from './provider';
import { DiscussionParticipant } from './participant';
import { SearchResult, UserProfile, DiscussionMode, DiscussionDepth, DirectionGuide, TerminationConfig } from './config';
import { FollowUpQuestion } from './followup';

// 議論メッセージ
export interface DiscussionMessage {
  id: string;
  provider: AIProviderType;
  model?: string;
  content: string;
  round: number;
  timestamp: Date;
  isLoading?: boolean;
  prompt?: string; // AIに渡されたプロンプト（確認用）
}

// 議論の状態
export interface DiscussionState {
  status: 'idle' | 'discussing' | 'summarizing' | 'completed' | 'error';
  topic: string;
  messages: DiscussionMessage[];
  currentRound: number;
  totalRounds: number;
  currentProvider: AIProviderType | null;
  finalAnswer: string | null;
  error: string | null;
}

// 過去のターンの要約（議論継続用）
export interface PreviousTurnSummary {
  topic: string;
  finalAnswer: string;
}

// 議論リクエスト
export interface DiscussionRequest {
  topic: string;
  participants: DiscussionParticipant[];
  rounds: number;
  previousTurns?: PreviousTurnSummary[];
}

// 検索付き議論リクエスト
export interface SearchBasedDiscussionRequest extends DiscussionRequest {
  searchConfig?: import('./config').SearchConfig;
  searchResults?: SearchResult[];
}

// 議論ターン（ユーザーの質問とAIの議論・回答のセット）
export interface DiscussionTurn {
  id: string;
  topic: string;
  messages: DiscussionMessage[];
  finalAnswer: string;
  summaryPrompt?: string; // 統合回答生成に使用したプロンプト
  searchResults?: SearchResult[];
  suggestedFollowUps?: FollowUpQuestion[]; // AI生成のフォローアップ質問候補
  createdAt: Date;
  // 分岐・フォーク用
  parentTurnId?: string;  // 分岐元のターンID
  branchLabel?: string;   // 分岐のラベル
}

// 中断された議論の進行状態（セッション内保存用）
export interface InterruptedTurnState {
  topic: string;
  participants: DiscussionParticipant[]; // 中断時の参加者（セッションの参加者と同期するために保存）
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
  interruptedAt: Date;
}

// メッセージへの投票/評価
export interface MessageVote {
  messageId: string;
  vote: 'agree' | 'disagree' | 'neutral';
  timestamp: Date;
}

// メッセージの評価集計
export interface MessageRating {
  messageId: string;
  agrees: number;
  disagrees: number;
  neutrals: number;
}

// 中断された議論の状態
export interface InterruptedDiscussionState {
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
  interruptedAt: Date;
}
