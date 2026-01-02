// Re-export everything from the discussion-engine module for backward compatibility
export type { DiscussionProgress, ResumeFromState, DiscussionRequest } from './discussion-engine/types';
export { getProviderDisplayName } from './discussion-engine/types';
export { checkConsensus, checkTerminationKeywords } from './discussion-engine/termination';
export { runDiscussion } from './discussion-engine/index';
