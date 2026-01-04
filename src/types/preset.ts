import { DiscussionParticipant } from './participant';
import {
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  TerminationConfig,
  SearchConfig,
  UserProfile,
} from './config';

// プリセットID生成
export function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 設定プリセットの型
export interface SettingsPreset {
  id: string;
  name: string;
  description?: string;

  // 全設定を含む
  participants: DiscussionParticipant[];
  discussionMode: DiscussionMode;
  discussionDepth: DiscussionDepth;
  directionGuide: DirectionGuide;
  terminationConfig: TerminationConfig;
  searchConfig: SearchConfig;
  userProfile: UserProfile;

  // メタデータ
  createdAt: Date;
  updatedAt: Date;
}

// プリセット作成時の入力（id, createdAt, updatedAt は自動生成）
export type SettingsPresetInput = Omit<SettingsPreset, 'id' | 'createdAt' | 'updatedAt'>;

// プリセット更新時の入力
export type SettingsPresetUpdate = Partial<Omit<SettingsPreset, 'id' | 'createdAt'>>;

// プリセット検証結果
export interface PresetValidationResult {
  isValid: boolean;
  warnings: PresetWarning[];
}

// プリセット検証警告
export interface PresetWarning {
  type: 'missing_model' | 'invalid_setting';
  message: string;
  participantId?: string;
}
