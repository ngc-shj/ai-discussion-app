import { AIProviderType, AIRequest, AIResponse } from '@/types';

// モデル情報
export interface ModelInfo {
  id: string;
  name: string;
}

// ストリーミングコールバック型
export type StreamChunkCallback = (chunk: string) => void;

// AIプロバイダーの抽象インターフェース
export interface AIProvider {
  readonly type: AIProviderType;
  readonly name: string;

  generate(request: AIRequest): Promise<AIResponse>;
  // ストリーミング生成（オプション）- 対応プロバイダーのみ実装
  generateStream?(
    request: AIRequest,
    onChunk: StreamChunkCallback
  ): Promise<AIResponse>;
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
