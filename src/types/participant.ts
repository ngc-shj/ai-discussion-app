import { AIProviderType } from './provider';

// プリセットロールのID
export type PresetRoleId =
  | 'neutral'      // 中立的な立場
  | 'advocate'     // 賛成派・推進派
  | 'critic'       // 反対派・批判的
  | 'expert'       // 専門家・技術的視点
  | 'creative'     // 創造的・革新的視点
  | 'practical';   // 実用的・現実的視点

// 議論参加者のロール（プリセット or カスタムロールID）
export type ParticipantRole = PresetRoleId | string;

// プリセットロールの定義
export interface RolePreset {
  id: PresetRoleId;
  name: string;
  description: string;
  prompt: string;
}

// カスタムロールの定義
export interface CustomRole {
  id: string; // ユニークID（custom-xxx形式）
  name: string;
  description: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}

// カスタムロールIDを生成
export function generateCustomRoleId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ロールがカスタムロールかどうかを判定
export function isCustomRoleId(roleId: string): boolean {
  return roleId.startsWith('custom-');
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
  displayRoleName?: string; // ロールの表示名（プリセット・カスタム共通）
  customRolePrompt?: string; // カスタムロール（custom-xxx）の場合のプロンプト
}

// 参加者IDを生成
export function generateParticipantId(): string {
  return `participant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
