import { DiscussionMessage, DiscussionParticipant, PreviousTurnSummary, SearchResult, ROLE_PRESETS, UserProfile, DiscussionMode, DiscussionDepth, DirectionGuide, TerminationConfig, FollowUpQuestion, MessageVote } from '@/types';
import { createProvider, createDiscussionPrompt, createFollowUpPrompt, parseFollowUpResponse } from './ai-providers';

export interface DiscussionProgress {
  type: 'message' | 'summary' | 'error' | 'complete' | 'progress' | 'searching' | 'terminated' | 'followups' | 'ready_for_summary';
  message?: DiscussionMessage;
  finalAnswer?: string;
  summaryPrompt?: string;
  error?: string;
  searchResults?: SearchResult[];
  terminationReason?: string;
  suggestedFollowUps?: FollowUpQuestion[];
  messages?: DiscussionMessage[]; // ready_for_summary時に議論メッセージを含める
  progress?: {
    currentRound: number;
    totalRounds: number;
    currentParticipantIndex: number;
    totalParticipants: number;
    currentParticipant: DiscussionParticipant;
    isSummarizing: boolean;
  };
}

// 再開用のパラメータ
export interface ResumeFromState {
  messages: DiscussionMessage[];
  currentRound: number;
  currentParticipantIndex: number;
}

// 議論リクエストの型定義
export interface DiscussionRequest {
  topic: string;
  participants: DiscussionParticipant[];
  rounds: number;
  previousTurns?: PreviousTurnSummary[];
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  terminationConfig?: TerminationConfig;
  resumeFrom?: ResumeFromState; // 中断からの再開用
  messageVotes?: MessageVote[]; // ユーザーの投票（統合回答に反映）
  skipSummary?: boolean; // 統合回答生成をスキップ（ユーザーが投票後に手動で生成）
}

// 合意判定用のキーワード
const CONSENSUS_KEYWORDS = [
  '同意します', '賛成です', '合意です', '異論ありません',
  '同じ意見です', '同感です', 'I agree', 'agreed',
  '結論として', 'まとめると', '全員一致',
];

// 合意度をチェック
function checkConsensus(messages: DiscussionMessage[], threshold: number): boolean {
  if (messages.length < 2) return false;

  // 最新ラウンドのメッセージを取得
  const maxRound = Math.max(...messages.map(m => m.round));
  const latestMessages = messages.filter(m => m.round === maxRound);

  if (latestMessages.length < 2) return false;

  // 各メッセージで合意キーワードをチェック
  let consensusCount = 0;
  for (const msg of latestMessages) {
    const content = msg.content.toLowerCase();
    if (CONSENSUS_KEYWORDS.some(kw => content.includes(kw.toLowerCase()))) {
      consensusCount++;
    }
  }

  const consensusRatio = consensusCount / latestMessages.length;
  return consensusRatio >= threshold;
}

// 終了キーワードをチェック
function checkTerminationKeywords(content: string, keywords: string[]): boolean {
  const lowerContent = content.toLowerCase();
  return keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
}

// 議論を実行するジェネレーター関数
export async function* runDiscussion(
  request: DiscussionRequest
): AsyncGenerator<DiscussionProgress> {
  const { topic, participants, rounds, previousTurns, searchResults, userProfile, discussionMode, discussionDepth, directionGuide, terminationConfig, resumeFrom, messageVotes, skipSummary } = request;

  // 再開時は既存のメッセージから開始
  const messages: DiscussionMessage[] = resumeFrom?.messages ? [...resumeFrom.messages] : [];
  let messageId = messages.length;
  let terminated = false;
  let terminationReason = '';

  // 再開位置
  const startRound = resumeFrom?.currentRound || 1;
  const startParticipantIndex = resumeFrom?.currentParticipantIndex || 0;

  // 過去のターンの要約を準備（最新5件まで）
  const turnContext: PreviousTurnSummary[] | undefined = previousTurns?.slice(-5);

  // 終了条件の設定（デフォルト: ラウンド数）
  const termConfig: TerminationConfig = terminationConfig || {
    condition: 'rounds',
    maxRounds: rounds,
  };

  // 実際の最大ラウンド数
  const effectiveMaxRounds = termConfig.condition === 'manual'
    ? termConfig.maxRounds
    : Math.min(rounds, termConfig.maxRounds);

  // 各ラウンドで全参加者が発言
  for (let round = startRound; round <= effectiveMaxRounds && !terminated; round++) {
    // 再開時の最初のラウンドでは、中断位置から開始
    const pStartIndex = (round === startRound) ? startParticipantIndex : 0;

    for (let pIndex = pStartIndex; pIndex < participants.length && !terminated; pIndex++) {
      const participant = participants[pIndex];

      // 進捗情報を送信
      yield {
        type: 'progress',
        progress: {
          currentRound: round,
          totalRounds: rounds,
          currentParticipantIndex: pIndex,
          totalParticipants: participants.length,
          currentParticipant: participant,
          isSummarizing: false,
        },
      };

      const provider = createProvider(participant.provider, participant.model);
      const isAvailable = await provider.isAvailable();

      if (!isAvailable) {
        console.error(`Provider not available: ${participant.displayName} (${participant.provider}/${participant.model})`);
        yield {
          type: 'error',
          error: `${participant.displayName} is not available`,
        };
        continue;
      }

      // プロンプトを生成
      const previousMessages = messages.map((m) => {
        // メッセージに対応する参加者のロールを取得
        const msgParticipant = participants.find(
          (p) => p.provider === m.provider && p.model === m.model
        );
        const rolePreset = msgParticipant?.role
          ? ROLE_PRESETS.find((r) => r.id === msgParticipant.role)
          : undefined;
        return {
          provider: m.model ? `${getProviderDisplayName(m.provider)} (${m.model})` : getProviderDisplayName(m.provider),
          content: m.content,
          role: rolePreset?.name,
        };
      });

      const prompt = createDiscussionPrompt(
        topic,
        previousMessages,
        messages.length === 0,
        false,
        turnContext,
        searchResults,
        participant.role,
        participant.customRolePrompt,
        participants,
        participant,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide
      );

      // AIに問い合わせ
      const response = await provider.generate({ prompt });

      if (response.error) {
        yield {
          type: 'error',
          error: `${participant.displayName}: ${response.error}`,
        };
        continue;
      }

      const message: DiscussionMessage = {
        id: `msg-${++messageId}`,
        provider: participant.provider,
        model: participant.model,
        content: response.content,
        round,
        timestamp: new Date(),
        prompt, // AIに渡されたプロンプトを保存
      };

      messages.push(message);

      yield {
        type: 'message',
        message,
      };

      // 終了条件のチェック（ラウンド終了後）
      if (pIndex === participants.length - 1) {
        // 合意形成による終了
        if (termConfig.condition === 'consensus') {
          const threshold = termConfig.consensusThreshold || 0.7;
          if (checkConsensus(messages, threshold)) {
            terminated = true;
            terminationReason = '参加者間で合意が形成されました';
            yield {
              type: 'terminated',
              terminationReason,
            };
          }
        }

        // キーワードによる終了
        if (termConfig.condition === 'keyword' && termConfig.terminationKeywords) {
          if (checkTerminationKeywords(message.content, termConfig.terminationKeywords)) {
            terminated = true;
            terminationReason = '終了キーワードが検出されました';
            yield {
              type: 'terminated',
              terminationReason,
            };
          }
        }
      }
    }
  }

  // メッセージがない場合は統合回答を生成しない
  if (messages.length === 0) {
    const providerNames = participants.map(p => p.displayName).join(', ');
    console.error(`All providers failed. Attempted providers: ${providerNames}`);
    yield {
      type: 'error',
      error: `No messages were generated. All providers failed (${providerNames}).`,
    };
    return;
  }

  // skipSummaryがtrueの場合、統合回答生成をスキップしてready_for_summaryイベントを送信
  if (skipSummary) {
    yield {
      type: 'ready_for_summary',
      messages: messages,
    };
    yield {
      type: 'complete',
    };
    return;
  }

  // 統合中の進捗を送信
  yield {
    type: 'progress',
    progress: {
      currentRound: rounds,
      totalRounds: rounds,
      currentParticipantIndex: participants.length - 1,
      totalParticipants: participants.length,
      currentParticipant: participants[0],
      isSummarizing: true,
    },
  };

  // 議論に成功した参加者を使用して統合回答を生成
  const successfulParticipants = participants.filter((p) =>
    messages.some((m) => m.provider === p.provider && m.model === p.model)
  );

  let summaryContent: string | null = null;
  let usedSummaryPrompt: string | null = null;

  for (const participant of successfulParticipants) {
    const summaryProvider = createProvider(participant.provider, participant.model);

    const allMessages = messages.map((m) => {
      const msgParticipant = participants.find(
        (p) => p.provider === m.provider && p.model === m.model
      );
      const rolePreset = msgParticipant?.role
        ? ROLE_PRESETS.find((r) => r.id === msgParticipant.role)
        : undefined;
      return {
        provider: m.model ? `${getProviderDisplayName(m.provider)} (${m.model})` : getProviderDisplayName(m.provider),
        content: m.content,
        role: rolePreset?.name,
        messageId: m.id,
      };
    });

    const summaryPrompt = createDiscussionPrompt(topic, allMessages, false, true, turnContext, searchResults, undefined, undefined, participants, undefined, userProfile, discussionMode, discussionDepth, directionGuide, messageVotes);
    const summaryResponse = await summaryProvider.generate({ prompt: summaryPrompt });

    if (!summaryResponse.error && summaryResponse.content) {
      summaryContent = summaryResponse.content;
      usedSummaryPrompt = summaryPrompt;
      break;
    } else {
      yield {
        type: 'error',
        error: `Summary generation failed with ${participant.displayName}: ${summaryResponse.error}`,
      };
    }
  }

  if (summaryContent) {
    yield {
      type: 'summary',
      finalAnswer: summaryContent,
      summaryPrompt: usedSummaryPrompt || undefined,
    };

    // フォローアップ質問を生成
    try {
      const followUpProvider = successfulParticipants[0];
      if (followUpProvider) {
        const provider = createProvider(followUpProvider.provider, followUpProvider.model);
        const followUpPromptText = createFollowUpPrompt(topic, summaryContent, userProfile);
        const followUpResponse = await provider.generate({ prompt: followUpPromptText });

        if (!followUpResponse.error && followUpResponse.content) {
          const followUpQuestions = parseFollowUpResponse(followUpResponse.content);
          if (followUpQuestions.length > 0) {
            yield {
              type: 'followups',
              suggestedFollowUps: followUpQuestions,
            };
          }
        }
      }
    } catch (error) {
      // フォローアップ質問の生成に失敗しても議論は完了とする
      console.error('Failed to generate follow-up questions:', error);
    }
  } else {
    yield {
      type: 'error',
      error: 'Failed to generate summary with all available providers',
    };
  }

  yield {
    type: 'complete',
  };
}

function getProviderDisplayName(type: string): string {
  const names: Record<string, string> = {
    claude: 'Claude',
    ollama: 'Ollama',
    openai: 'ChatGPT',
    gemini: 'Gemini',
  };
  return names[type] || type;
}
