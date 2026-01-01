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
  provider: AIProviderType;
  model: string;
  displayName: string;
  color: string;
  role?: ParticipantRole;
  customRolePrompt?: string; // role === 'custom' の場合に使用
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

// 議論ターン（ユーザーの質問とAIの議論・回答のセット）
export interface DiscussionTurn {
  id: string;
  topic: string;
  messages: DiscussionMessage[];
  finalAnswer: string;
  searchResults?: SearchResult[];
  createdAt: Date;
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
