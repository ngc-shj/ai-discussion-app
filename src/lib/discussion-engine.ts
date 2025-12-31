import { DiscussionMessage, DiscussionRequest, DiscussionParticipant, PreviousTurnSummary } from '@/types';
import { createProvider, createDiscussionPrompt } from './ai-providers';

export interface DiscussionProgress {
  type: 'message' | 'summary' | 'error' | 'complete' | 'progress';
  message?: DiscussionMessage;
  finalAnswer?: string;
  error?: string;
  progress?: {
    currentRound: number;
    totalRounds: number;
    currentParticipantIndex: number;
    totalParticipants: number;
    currentParticipant: DiscussionParticipant;
    isSummarizing: boolean;
  };
}

// 議論を実行するジェネレーター関数
export async function* runDiscussion(
  request: DiscussionRequest
): AsyncGenerator<DiscussionProgress> {
  const { topic, participants, rounds, previousTurns } = request;
  const messages: DiscussionMessage[] = [];
  let messageId = 0;

  // 過去のターンの要約を準備（最新5件まで）
  const turnContext: PreviousTurnSummary[] | undefined = previousTurns?.slice(-5);

  // 各ラウンドで全参加者が発言
  for (let round = 1; round <= rounds; round++) {
    for (let pIndex = 0; pIndex < participants.length; pIndex++) {
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
        yield {
          type: 'error',
          error: `${participant.displayName} is not available`,
        };
        continue;
      }

      // プロンプトを生成
      const previousMessages = messages.map((m) => ({
        provider: m.model ? `${getProviderDisplayName(m.provider)} (${m.model})` : getProviderDisplayName(m.provider),
        content: m.content,
      }));

      const prompt = createDiscussionPrompt(
        topic,
        previousMessages,
        messages.length === 0,
        false,
        turnContext
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
    }
  }

  // メッセージがない場合は統合回答を生成しない
  if (messages.length === 0) {
    yield {
      type: 'error',
      error: 'No messages were generated. All providers failed.',
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

    const allMessages = messages.map((m) => ({
      provider: m.model ? `${getProviderDisplayName(m.provider)} (${m.model})` : getProviderDisplayName(m.provider),
      content: m.content,
    }));

    const summaryPrompt = createDiscussionPrompt(topic, allMessages, false, true, turnContext);
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
