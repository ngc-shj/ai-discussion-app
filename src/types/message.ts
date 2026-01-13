import { AIProviderType } from './provider';
import { DiscussionParticipant } from './participant';
import { SearchResult, SearchKeywordInfo, SearchConfig, UserProfile, DiscussionMode, DiscussionDepth, DirectionGuide, TerminationConfig } from './config';
import { FollowUpQuestion } from './followup';

// 添付コンテンツ（ファイルまたは貼り付け）
export interface AttachedContent {
  content: string;
  fileName?: string;  // ファイル名（ファイル添付の場合のみ）
}

// 構造化トピック（貼り付けコンテンツとユーザーの質問を分離）
export interface StructuredTopic {
  pastedContents?: string[];  // 貼り付けられたコンテンツ（複数可）- 後方互換性のため維持
  attachedContents?: AttachedContent[];  // 添付コンテンツ（ファイル名情報付き）
  question: string;           // ユーザーの質問/コメント
}

// トピック文字列から構造化トピックを抽出
export function parseStructuredTopic(topic: string): StructuredTopic {
  const attachedContents: AttachedContent[] = [];

  // attached-fileタグを抽出（ファイル名付き）
  const attachedFileRegex = /<attached-file\s+name="([^"]+)">([\s\S]*?)<\/attached-file>/g;
  let match;
  while ((match = attachedFileRegex.exec(topic)) !== null) {
    attachedContents.push({
      content: match[2].trim(),
      fileName: match[1],
    });
  }

  // pasted-contentタグを抽出
  const pastedContentRegex = /<pasted-content[^>]*>([\s\S]*?)<\/pasted-content>/g;
  while ((match = pastedContentRegex.exec(topic)) !== null) {
    attachedContents.push({
      content: match[1].trim(),
    });
  }

  // タグを除去した残りがユーザーの質問
  let question = topic
    .replace(attachedFileRegex, '')
    .replace(pastedContentRegex, '')
    .trim();

  // 後方互換性のためpastedContentsも設定
  const pastedContents = attachedContents.map(a => a.content);

  return {
    pastedContents: pastedContents.length > 0 ? pastedContents : undefined,
    attachedContents: attachedContents.length > 0 ? attachedContents : undefined,
    question: question || '（貼り付けコンテンツの分析）',
  };
}

// 構造化トピックをフォーマット（プロンプト用）
export function formatStructuredTopic(structured: StructuredTopic): string {
  if (!structured.pastedContents || structured.pastedContents.length === 0) {
    return structured.question;
  }
  const pastedParts = structured.pastedContents.map((content, index) => {
    if (structured.pastedContents!.length === 1) {
      return `<pasted-content>\n${content}\n</pasted-content>`;
    }
    return `<pasted-content id="${index + 1}">\n${content}\n</pasted-content>`;
  }).join('\n\n');
  // 質問を先に、添付コンテンツを後に配置
  return structured.question
    ? `${structured.question}\n\n${pastedParts}`
    : pastedParts;
}

// UI表示用のトピック最大長
export const UI_TOPIC_MAX_LENGTH = 100;

// ログ出力用のトピック最大長
export const LOG_TOPIC_MAX_LENGTH = 200;

// トピックを表示用にフォーマット（添付コンテンツを省略）
export function formatTopicForDisplay(topic: string, maxLength: number = UI_TOPIC_MAX_LENGTH): string {
  const structured = parseStructuredTopic(topic);
  const question = structured.question;
  const hasPasted = structured.pastedContents && structured.pastedContents.length > 0;

  let displayText = question;
  if (hasPasted) {
    const count = structured.pastedContents!.length;
    const suffix = count === 1 ? '（添付コンテンツあり）' : `（添付コンテンツ${count}件）`;
    displayText = question !== '（貼り付けコンテンツの分析）'
      ? `${question} ${suffix}`
      : suffix;
  }

  if (displayText.length > maxLength) {
    return displayText.slice(0, maxLength) + '...';
  }
  return displayText;
}

// 統合回答のフェーズ
export type SummaryPhase =
  | 'idle'           // 通常状態（議論中または議論前）
  | 'awaiting'       // 統合回答ボタン表示中（ユーザーのクリック待ち）
  | 'generating';    // 統合回答生成中

// 議論メッセージ
export interface DiscussionMessage {
  id: string;
  participantId: string; // 参加者への参照（実行中はこれで参照）
  provider: AIProviderType;
  model?: string;
  content: string;
  round: number;
  timestamp: Date;
  isLoading?: boolean;
  isStreaming?: boolean;
  prompt?: string; // AIに渡されたプロンプト（確認用）
  // 表示用情報のスナップショット（永続化・履歴表示用）
  // 実行中は participantId から取得、保存時にスナップショットとして設定
  displayName?: string; // 表示名（例: "批判的 (llama3.2:latest)"）
  displayRoleName?: string; // ロール名（例: "批判的"）
  color?: string; // 参加者の色
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
  searchKeywords?: SearchKeywordInfo[]; // 検索に使用したキーワード
  suggestedFollowUps?: FollowUpQuestion[]; // AI生成のフォローアップ質問候補
  createdAt: Date;
  // 分岐・フォーク用
  parentTurnId?: string;  // 分岐元のターンID
  branchLabel?: string;   // 分岐のラベル
  // 議論マーカー（履歴表示用）
  startMarker?: StartMarker;        // 議論開始時の設定
  extensionMarkers?: ExtensionMarker[];  // 議論延長マーカー
}

// 中断された議論の進行状態（セッション内保存用）
// 注意: フィールドを追加・変更した場合、以下も合わせて更新すること:
//   - InterruptedDiscussionSnapshot（同ファイル内）
//   - useSessionManager.ts の selectSession と初期ロード処理
//   - session-storage.ts の serializeSession / deserializeSession
export interface InterruptedTurnSnapshot {
  topic: string;
  participants: DiscussionParticipant[]; // 中断時の参加者（セッションの参加者と同期するために保存）
  messages: DiscussionMessage[];
  currentRound: number;
  currentParticipantIndex: number;
  totalRounds: number;
  searchResults?: SearchResult[];
  searchKeywords?: SearchKeywordInfo[]; // 検索キーワード
  completedSearchKeywordIndex?: number; // 完了した検索キーワードのインデックス（再開時に続きから検索）
  searchConfig?: SearchConfig; // 検索設定（再開時に検索を実行するために必要）
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
  interruptedAt: Date;
  summaryPhase?: SummaryPhase; // 統合回答のフェーズ
  // 議論マーカー
  startMarker?: StartMarker;
  extensionMarkers?: ExtensionMarker[];
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
// 注意: フィールドを追加・変更した場合、以下も合わせて更新すること:
//   - InterruptedTurnSnapshot（同ファイル内）
//   - useSessionManager.ts の selectSession と初期ロード処理
//   - session-storage.ts の serializeInterruptedState / deserializeInterruptedState
export interface InterruptedDiscussionSnapshot {
  sessionId: string;
  topic: string;
  participants: DiscussionParticipant[];
  messages: DiscussionMessage[];
  currentRound: number;
  currentParticipantIndex: number;
  totalRounds: number;
  searchResults?: SearchResult[];
  searchKeywords?: SearchKeywordInfo[]; // 検索キーワード
  completedSearchKeywordIndex?: number; // 完了した検索キーワードのインデックス（再開時に続きから検索）
  searchConfig?: SearchConfig;
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
  interruptedAt: Date;
  summaryPhase?: SummaryPhase; // 統合回答のフェーズ
  // 議論マーカー
  startMarker?: StartMarker;
  extensionMarkers?: ExtensionMarker[];
}

// 議論開始マーカー（表示用）
export interface StartMarker {
  totalRounds: number;        // 総ラウンド数
  mode: DiscussionMode;       // 議論モード
  depth: DiscussionDepth;     // 議論の深さ
  keywords?: string[];        // キーワード
  timestamp: Date;
}

// 議論延長マーカー（表示用）
export interface ExtensionMarker {
  afterRound: number;         // このラウンドの後に延長された
  additionalRounds: number;   // 追加されたラウンド数
  newTotalRounds: number;     // 延長後の総ラウンド数
  modeChanged?: {
    from: DiscussionMode;
    to: DiscussionMode;
  };
  depthChanged?: {
    from: DiscussionDepth;
    to: DiscussionDepth;
  };
  keywordsAdded?: string[];
  timestamp: Date;
}
