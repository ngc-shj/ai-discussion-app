// Provider types
export type { AIProviderType, ModelInfo, AIProviderConfig, AIRequest, AIResponse } from './provider';
export { DEFAULT_PROVIDERS, getOllamaModelColor } from './provider';

// Participant types
export type { PresetRoleId, ParticipantRole, RolePreset, CustomRole, DiscussionParticipant } from './participant';
export { ROLE_PRESETS, generateParticipantId, generateCustomRoleId, isCustomRoleId } from './participant';

// Message types
export type {
  SummaryState,
  DiscussionMessage,
  DiscussionState,
  PreviousTurnSummary,
  DiscussionRequest,
  SearchBasedDiscussionRequest,
  DiscussionTurn,
  InterruptedTurnState,
  MessageVote,
  MessageRating,
  InterruptedDiscussionState,
} from './message';

// Session types
export type { TurnBranch, DiscussionSession } from './session';

// Config types
export type {
  SearchResult,
  SearchConfig,
  TechLevel,
  ResponseStyle,
  UserProfile,
  DiscussionMode,
  DiscussionModePreset,
  DiscussionDepth,
  DiscussionDepthPreset,
  DirectionGuide,
  TerminationCondition,
  TerminationConfig,
  TerminationPreset,
} from './config';
export {
  TECH_LEVEL_PRESETS,
  RESPONSE_STYLE_PRESETS,
  DISCUSSION_MODE_PRESETS,
  DISCUSSION_DEPTH_PRESETS,
  TERMINATION_PRESETS,
} from './config';

// Follow-up types
export type { FollowUpCategory, FollowUpQuestion } from './followup';
export { FOLLOW_UP_CATEGORY_LABELS } from './followup';

// Deep dive types
export type { DeepDiveType, DeepDivePreset } from './deepdive';
export { DEEP_DIVE_PRESETS } from './deepdive';

// Fork types
export type { ForkPreset } from './fork';
export { FORK_PRESETS } from './fork';
