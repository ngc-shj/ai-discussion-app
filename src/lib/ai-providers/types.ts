import { AIProviderType, AIRequest, AIResponse } from '@/types';

// モデル情報
export interface ModelInfo {
  id: string;
  name: string;
}

// AIプロバイダーの抽象インターフェース
export interface AIProvider {
  readonly type: AIProviderType;
  readonly name: string;

  generate(request: AIRequest): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
}

// 過去のターンの要約
export interface PreviousTurnSummary {
  topic: string;
  finalAnswer: string;
}

// Re-export from prompt modules for backward compatibility
export {
  formatSearchResults,
  getRolePrompt,
  formatUserProfile,
  formatParticipantsList,
  getDiscussionModePrompt,
  getDepthPrompt,
  formatDirectionGuide,
  formatMessageVotes,
} from './prompt-formatters';

export {
  createDiscussionPrompt,
  createFollowUpPrompt,
  parseFollowUpResponse,
} from './prompt-builders';
