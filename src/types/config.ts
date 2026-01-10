// SearXNG検索結果
export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
  publishedDate?: string;
}

// 検索タイミング設定
export interface SearchTiming {
  onStart: boolean;        // 議論開始時に検索
  beforeSummary: boolean;  // 統合回答生成前に検索
  onDemand: boolean;       // AIが要求した時に検索（[[SEARCH:query]]パターン）
}

// 検索設定
export interface SearchConfig {
  enabled: boolean;
  query?: string; // カスタム検索クエリ（空の場合はトピックを使用）
  maxResults: number;
  searchType: 'web' | 'news' | 'images';
  language?: string;
  engines?: string[]; // 使用する検索エンジン
  timing: SearchTiming; // 検索タイミング
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
