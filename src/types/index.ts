// AIプロバイダーの種類
export type AIProviderType = 'claude' | 'ollama' | 'openai' | 'gemini';

// モデル情報
export interface ModelInfo {
  id: string;
  name: string;
}

// 議論参加者のロール
export type ParticipantRole =
  | 'neutral'      // 中立的な立場
  | 'advocate'     // 賛成派・推進派
  | 'critic'       // 反対派・批判的
  | 'expert'       // 専門家・技術的視点
  | 'creative'     // 創造的・革新的視点
  | 'practical'    // 実用的・現実的視点
  | 'custom';      // カスタムロール

// プリセットロールの定義
export interface RolePreset {
  id: ParticipantRole;
  name: string;
  description: string;
  prompt: string;
}

// プリセットロール一覧
export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'neutral',
    name: '中立',
    description: 'バランスの取れた客観的な視点で議論',
    prompt: 'あなたは中立的な立場から、バランスの取れた客観的な意見を述べてください。',
  },
  {
    id: 'advocate',
    name: '賛成派',
    description: 'トピックに対して肯定的・推進的な立場',
    prompt: 'あなたは賛成派として、このトピックのメリットや可能性を強調してください。建設的な提案を心がけてください。',
  },
  {
    id: 'critic',
    name: '批判派',
    description: 'トピックに対して批判的・慎重な立場',
    prompt: 'あなたは批判的な立場から、リスクや問題点、考慮すべき課題を指摘してください。ただし建設的な批判を心がけてください。',
  },
  {
    id: 'expert',
    name: '専門家',
    description: '技術的・専門的な観点から分析',
    prompt: 'あなたは専門家として、技術的・専門的な観点から深い分析と洞察を提供してください。',
  },
  {
    id: 'creative',
    name: '創造派',
    description: '革新的・創造的なアイデアを提案',
    prompt: 'あなたは創造的な思考者として、斬新なアイデアや既存の枠にとらわれない視点を提案してください。',
  },
  {
    id: 'practical',
    name: '実務派',
    description: '実用的・現実的な観点から評価',
    prompt: 'あなたは実務家として、実現可能性やコスト、実装の現実的な課題について意見を述べてください。',
  },
];

// 議論参加者（プロバイダー + モデルの組み合わせ）
export interface DiscussionParticipant {
  id: string; // 一意のID（同一モデルを複数追加可能にするため）
  provider: AIProviderType;
  model: string;
  displayName: string;
  color: string;
  role?: ParticipantRole;
  customRolePrompt?: string; // role === 'custom' の場合に使用
}

// 参加者IDを生成
export function generateParticipantId(): string {
  return `participant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// AIプロバイダーの設定
export interface AIProviderConfig {
  id: AIProviderType;
  name: string;
  color: string;
  defaultModel: string;
}

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

// AIプロバイダーへのリクエスト
export interface AIRequest {
  prompt: string;
  context?: string;
  previousMessages?: Array<{
    provider: string;
    content: string;
  }>;
}

// AIプロバイダーからのレスポンス
export interface AIResponse {
  content: string;
  provider: AIProviderType;
  error?: string;
}

// プロバイダーのデフォルト設定
export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    color: '#D97706',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#059669',
    defaultModel: 'gpt-oss:20b',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    color: '#10B981',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285F4',
    defaultModel: 'gemini-1.5-flash',
  },
];

// Ollamaモデル用の色を生成
export function getOllamaModelColor(modelId: string): string {
  const colors = ['#059669', '#0D9488', '#0891B2', '#0284C7', '#2563EB', '#4F46E5', '#7C3AED', '#9333EA'];
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    hash = modelId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// フォローアップ質問のカテゴリ
export type FollowUpCategory = 'clarification' | 'expansion' | 'example' | 'alternative';

// フォローアップ質問
export interface FollowUpQuestion {
  id: string;
  question: string;
  category: FollowUpCategory;
}

// フォローアップカテゴリのラベル
export const FOLLOW_UP_CATEGORY_LABELS: Record<FollowUpCategory, string> = {
  clarification: '詳細',
  expansion: '拡張',
  example: '具体例',
  alternative: '別視点',
};

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

// 議論セッション（複数のターンを含む）
export interface DiscussionSession {
  id: string;
  title: string;
  turns: DiscussionTurn[];
  participants: DiscussionParticipant[];
  rounds: number;
  createdAt: Date;
  updatedAt: Date;
  interruptedTurn?: InterruptedTurnState; // 中断された議論がある場合
  branches?: TurnBranch[]; // 分岐一覧
}

// SearXNG検索結果
export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
  publishedDate?: string;
}

// 検索設定
export interface SearchConfig {
  enabled: boolean;
  query?: string; // カスタム検索クエリ（空の場合はトピックを使用）
  maxResults: number;
  searchType: 'web' | 'news' | 'images';
  language?: string;
  engines?: string[]; // 使用する検索エンジン
}

// 検索付き議論リクエスト
export interface SearchBasedDiscussionRequest extends DiscussionRequest {
  searchConfig?: SearchConfig;
  searchResults?: SearchResult[];
}

// ユーザーの技術レベル
export type TechLevel = 'beginner' | 'intermediate' | 'advanced';

// 回答スタイルの好み
export type ResponseStyle = 'concise' | 'detailed' | 'technical' | 'simple';

// ユーザープロファイル
export interface UserProfile {
  name?: string;                    // 名前（任意）
  occupation?: string;              // 職業・専門分野
  techLevel?: TechLevel;            // 技術レベル
  interests?: string[];             // 関心のある領域
  responseStyle?: ResponseStyle;    // 回答スタイルの好み
  customContext?: string;           // その他のコンテキスト（自由記述）
}

// 技術レベルのプリセット
export const TECH_LEVEL_PRESETS: { id: TechLevel; name: string; description: string }[] = [
  { id: 'beginner', name: '初心者', description: '基礎から丁寧に説明してほしい' },
  { id: 'intermediate', name: '中級者', description: '基本は理解しているので応用的な内容を' },
  { id: 'advanced', name: '上級者', description: '専門用語や高度な概念も使ってOK' },
];

// 回答スタイルのプリセット
export const RESPONSE_STYLE_PRESETS: { id: ResponseStyle; name: string; description: string }[] = [
  { id: 'concise', name: '簡潔', description: 'ポイントを絞った短い回答' },
  { id: 'detailed', name: '詳細', description: '背景や理由も含めた詳しい回答' },
  { id: 'technical', name: '技術的', description: '専門用語や技術的な詳細を含む' },
  { id: 'simple', name: '平易', description: '専門用語を避けたわかりやすい説明' },
];

// 議論モードの種類
export type DiscussionMode =
  | 'free'           // 自由議論（デフォルト）
  | 'brainstorm'     // ブレインストーミング
  | 'debate'         // ディベート
  | 'consensus'      // コンセンサス形成
  | 'critique'       // 批判的レビュー
  | 'counterargument'; // 反論モード

// 議論モードのプリセット
export interface DiscussionModePreset {
  id: DiscussionMode;
  name: string;
  description: string;
  prompt: string;
  summaryPrompt: string;
}

// 議論モードプリセット一覧
export const DISCUSSION_MODE_PRESETS: DiscussionModePreset[] = [
  {
    id: 'free',
    name: '自由議論',
    description: '制約なく自由に意見を交換',
    prompt: '',
    summaryPrompt: '',
  },
  {
    id: 'brainstorm',
    name: 'ブレスト',
    description: 'アイデアを広げる発散思考',
    prompt: `【議論モード: ブレインストーミング】
- 批判や否定を控え、まずはアイデアを出すことを優先してください
- 他の参加者のアイデアに乗っかって発展させることを歓迎します
- 突飛なアイデアや斬新な発想も積極的に出してください
- 「それは無理」「現実的でない」といった否定的な言葉は避けてください`,
    summaryPrompt: `【ブレインストーミングの統合】
- 出されたアイデアをカテゴリ分けして整理してください
- 特に有望なアイデアをハイライトしてください
- アイデア同士の組み合わせで生まれる可能性も提示してください`,
  },
  {
    id: 'debate',
    name: 'ディベート',
    description: '賛否両論を明確に議論',
    prompt: `【議論モード: ディベート】
- 自分の立場（賛成/反対）を明確にしてから意見を述べてください
- 相手の意見に対して論理的に反論してください
- 感情的にならず、事実とロジックに基づいて議論してください
- 相手の良い点は認めつつも、弱点を指摘してください`,
    summaryPrompt: `【ディベートの統合】
- 賛成派と反対派の主要な論点を整理してください
- 双方の強い主張と弱い主張を分析してください
- 議論を踏まえた上での結論または判断材料を提示してください`,
  },
  {
    id: 'consensus',
    name: '合意形成',
    description: '共通点を探り合意を目指す',
    prompt: `【議論モード: コンセンサス形成】
- 他の参加者との共通点や合意できる部分を積極的に見つけてください
- 対立点がある場合は、妥協点や折衷案を提案してください
- 「〜という点では同意します」「〜については調整が必要ですが」といった形で建設的に議論してください
- 全員が納得できる着地点を目指してください`,
    summaryPrompt: `【コンセンサス形成の統合】
- 参加者間で合意が得られた点を明確にしてください
- まだ調整が必要な点があれば挙げてください
- 全体として合意できる結論または次のステップを提示してください`,
  },
  {
    id: 'critique',
    name: '批判的検討',
    description: '問題点やリスクを洗い出す',
    prompt: `【議論モード: 批判的レビュー】
- トピックの問題点、リスク、課題を積極的に指摘してください
- 「なぜそうなるのか」「本当にそうか」と疑問を持って分析してください
- 見落とされがちな観点や盲点を指摘してください
- 批判だけでなく、改善案や対策も提案してください`,
    summaryPrompt: `【批判的レビューの統合】
- 指摘された主要な問題点・リスクを整理してください
- 優先度や深刻度で分類してください
- 提案された改善策や対策をまとめてください`,
  },
  {
    id: 'counterargument',
    name: '反論モード',
    description: '統合回答に対する反論を生成',
    prompt: `【議論モード: 反論生成】
- あなたは批判的思考者として、提示された内容の問題点や盲点を指摘してください
- 単なる否定ではなく、論理的な根拠を持った反論を述べてください
- 反論が妥当である条件や状況も述べてください
- 建設的な批判を心がけ、改善案も提示してください`,
    summaryPrompt: `【反論の統合】
- 提示された反論のうち、特に重要なものを整理してください
- 各反論の妥当性を評価してください
- 反論を踏まえた上での、より堅牢な結論を提示してください`,
  },
];

// 議論の深さレベル（1-5）
export type DiscussionDepth = 1 | 2 | 3 | 4 | 5;

// 議論の深さプリセット
export interface DiscussionDepthPreset {
  level: DiscussionDepth;
  name: string;
  description: string;
  prompt: string;
  wordCount: string;
}

// 議論の深さプリセット一覧
export const DISCUSSION_DEPTH_PRESETS: DiscussionDepthPreset[] = [
  {
    level: 1,
    name: '概要',
    description: '要点のみ簡潔に',
    prompt: '【回答の深さ: 概要レベル】\n要点のみを簡潔にまとめてください。詳細な説明は不要です。',
    wordCount: '100-150文字',
  },
  {
    level: 2,
    name: '簡潔',
    description: '主要ポイントを短く',
    prompt: '【回答の深さ: 簡潔】\n主要なポイントを短くまとめてください。',
    wordCount: '150-250文字',
  },
  {
    level: 3,
    name: '標準',
    description: 'バランスの取れた説明',
    prompt: '', // デフォルトなのでプロンプト不要
    wordCount: '200-400文字',
  },
  {
    level: 4,
    name: '詳細',
    description: '背景や理由も含めて',
    prompt: '【回答の深さ: 詳細】\n背景情報や理由、具体例を含めて詳しく説明してください。',
    wordCount: '400-600文字',
  },
  {
    level: 5,
    name: '徹底',
    description: '多角的に深く分析',
    prompt: '【回答の深さ: 徹底分析】\n多角的な視点から深く分析し、根拠やデータ、具体例を豊富に含めて説明してください。反論への対応も検討してください。',
    wordCount: '600文字以上',
  },
];

// 議論の方向性ガイド
export interface DirectionGuide {
  keywords: string[];      // 注目してほしいキーワード
  focusAreas?: string[];   // 特に議論を深めたい領域
  avoidTopics?: string[];  // 避けたいトピック
}

// 議論の終了条件
export type TerminationCondition =
  | 'rounds'       // 指定ラウンド数で終了（デフォルト）
  | 'consensus'    // 合意に達したら終了
  | 'keyword'      // 特定キーワードで終了
  | 'manual';      // 手動で終了

// 終了条件の設定
export interface TerminationConfig {
  condition: TerminationCondition;
  maxRounds: number;           // 最大ラウンド数（安全策）
  consensusThreshold?: number; // 合意判定の閾値（0-1）
  terminationKeywords?: string[]; // 終了キーワード
}

// 終了条件プリセット
export interface TerminationPreset {
  id: TerminationCondition;
  name: string;
  description: string;
}

// 終了条件プリセット一覧
export const TERMINATION_PRESETS: TerminationPreset[] = [
  {
    id: 'rounds',
    name: 'ラウンド数',
    description: '指定したラウンド数で終了',
  },
  {
    id: 'consensus',
    name: '合意形成',
    description: '参加者が合意に達したら終了',
  },
  {
    id: 'keyword',
    name: 'キーワード',
    description: '特定のキーワードが出たら終了',
  },
  {
    id: 'manual',
    name: '手動',
    description: 'ユーザーが手動で終了',
  },
];

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

// 深掘りモードの種類
export type DeepDiveType =
  | 'technical'     // 技術的詳細
  | 'practical'     // 実践的な応用
  | 'theoretical'   // 理論的背景
  | 'comparison'    // 比較分析
  | 'implications'  // 影響と結果
  | 'custom';       // カスタム

// 深掘りプリセット
export interface DeepDivePreset {
  id: DeepDiveType;
  name: string;
  description: string;
  prompt: string;
}

// 深掘りプリセット一覧
export const DEEP_DIVE_PRESETS: DeepDivePreset[] = [
  {
    id: 'technical',
    name: '技術的詳細',
    description: '技術的な側面を深掘り',
    prompt: '技術的な詳細、実装方法、アーキテクチャについて深く掘り下げてください。',
  },
  {
    id: 'practical',
    name: '実践的応用',
    description: '実際の適用方法を検討',
    prompt: '実際にどのように適用できるか、具体的なステップや注意点について議論してください。',
  },
  {
    id: 'theoretical',
    name: '理論的背景',
    description: '背景にある理論を探求',
    prompt: '背景にある理論、原理原則、学術的な根拠について深く議論してください。',
  },
  {
    id: 'comparison',
    name: '比較分析',
    description: '他のアプローチと比較',
    prompt: '他のアプローチや代替案と比較し、それぞれの長所短所を分析してください。',
  },
  {
    id: 'implications',
    name: '影響と結果',
    description: '影響や将来への示唆を考察',
    prompt: 'この内容が持つ影響、結果、将来への示唆について深く考察してください。',
  },
];

// 分岐情報
export interface TurnBranch {
  turnId: string;
  label: string;
  createdAt: Date;
}

// 分岐プリセット
export interface ForkPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

// 分岐プリセット一覧
export const FORK_PRESETS: ForkPreset[] = [
  { id: 'technical', name: '技術的視点', description: '技術的な実現可能性や実装の観点から', prompt: '技術的な実現可能性、パフォーマンス、スケーラビリティ、実装の複雑さなどの観点から議論してください。' },
  { id: 'business', name: 'ビジネス視点', description: 'ビジネス価値やROIの観点から', prompt: 'ビジネス価値、投資対効果、市場競争力、収益性などの観点から議論してください。' },
  { id: 'ethical', name: '倫理的視点', description: '倫理的・社会的な影響の観点から', prompt: '倫理的な問題、社会的影響、公平性、プライバシーなどの観点から議論してください。' },
  { id: 'risk', name: 'リスク視点', description: 'リスクや課題の観点から', prompt: 'リスク、課題、障害となりうる要因、失敗シナリオなどの観点から議論してください。' },
];
