import { DiscussionParticipant } from './participant';
import { DiscussionTurn, InterruptedTurnState } from './message';

// 分岐情報
export interface TurnBranch {
  turnId: string;
  label: string;
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
  interruptedTurn?: InterruptedTurnState; // 中断された議論がある場合
  branches?: TurnBranch[]; // 分岐一覧
}
