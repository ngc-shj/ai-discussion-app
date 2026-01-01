import { DiscussionMessage, DiscussionParticipant, PreviousTurnSummary, SearchResult, ROLE_PRESETS, UserProfile, DiscussionMode, DiscussionDepth, DirectionGuide, TerminationConfig } from '@/types';
import { createProvider, createDiscussionPrompt } from './ai-providers';

export interface DiscussionProgress {
  type: 'message' | 'summary' | 'error' | 'complete' | 'progress' | 'searching' | 'terminated';
  message?: DiscussionMessage;
  finalAnswer?: string;
  error?: string;
  searchResults?: SearchResult[];
  terminationReason?: string;
  progress?: {
    currentRound: number;
    totalRounds: number;
    currentParticipantIndex: number;
    totalParticipants: number;
    currentParticipant: DiscussionParticipant;
    isSummarizing: boolean;
  };
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
  const { topic, participants, rounds, previousTurns, searchResults, userProfile, discussionMode, discussionDepth, directionGuide, terminationConfig } = request;
  const messages: DiscussionMessage[] = [];
  let messageId = 0;
  let terminated = false;
  let terminationReason = '';

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
  for (let round = 1; round <= effectiveMaxRounds && !terminated; round++) {
    for (let pIndex = 0; pIndex < participants.length && !terminated; pIndex++) {
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
      };
    });

    const summaryPrompt = createDiscussionPrompt(topic, allMessages, false, true, turnContext, searchResults, undefined, undefined, participants, undefined, userProfile, discussionMode, discussionDepth, directionGuide);
    const summaryResponse = await summaryProvider.generate({ prompt: summaryPrompt });

    if (!summaryResponse.error && summaryResponse.content) {
      summaryContent = summaryResponse.content;
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
    };
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
