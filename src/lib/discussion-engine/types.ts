import {
  DiscussionMessage,
  DiscussionParticipant,
  PreviousTurnSummary,
  SearchResult,
  SearchKeywordInfo,
  SearchConfig,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  FollowUpQuestion,
  MessageVote,
} from '@/types';

/**
 * 議論のSSEイベント（サーバーからクライアントへのリアルタイム通知）
 */
export interface DiscussionSSEEvent {
  type: 'message' | 'message_chunk' | 'summary' | 'error' | 'complete' | 'progress' | 'searching' | 'search_results' | 'search_keywords' | 'search_progress' | 'terminated' | 'followups' | 'ready_for_summary';
  message?: DiscussionMessage;
  messageId?: string;
  chunk?: string;
  accumulatedContent?: string;
  finalAnswer?: string;
  summaryPrompt?: string;
  error?: string;
  searchResults?: SearchResult[];
  searchResultsAccumulated?: SearchResult[]; // 累積検索結果（全タイミングの合計）
  searchKeywords?: SearchKeywordInfo; // 検索キーワード情報
  searchProgress?: {
    currentKeywordIndex: number;
    totalKeywords: number;
    currentKeyword: string;
    completedKeyword?: string;
  };
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
export interface ResumeFromParams {
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
  searchConfig?: SearchConfig; // 検索設定（eachRound検索に使用）
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
  resumeFrom?: ResumeFromParams; // 中断からの再開用
  messageVotes?: MessageVote[]; // ユーザーの投票（統合回答に反映）
  skipSummary?: boolean; // 統合回答生成をスキップ（ユーザーが投票後に手動で生成）
  onMessageChunk?: OnMessageChunkCallback; // ストリーミングチャンクのコールバック
  onSearchResult?: OnSearchResultCallback; // 検索結果のコールバック
}

/**
 * 検索結果のコールバック型
 */
export type OnSearchResultCallback = (results: SearchResult[]) => void;

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
