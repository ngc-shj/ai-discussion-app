import { DiscussionMessage, DiscussionParticipant, TerminationConfig, ROLE_PRESETS, UserProfile, SearchResult, SearchConfig, formatParticipantDisplayName } from '@/types';
import { createProvider, createDiscussionPrompt, createFollowUpPrompt, parseFollowUpResponse } from '../ai-providers';
import { DiscussionProgress, DiscussionRequest, getProviderDisplayName } from './types';
import { checkConsensus, checkTerminationKeywords } from './termination';
import { performSearch, mergeSearchResults } from '../search';

// Re-export types
export type { DiscussionProgress, ResumeFromState, DiscussionRequest } from './types';
export { getProviderDisplayName } from './types';
export { checkConsensus, checkTerminationKeywords } from './termination';

// 検索パターン: {{SEARCH:query}} または {{検索:query}}
const SEARCH_PATTERN = /\{\{(?:SEARCH|検索):(.+?)\}\}/g;

/**
 * AIの応答から検索パターンを抽出
 */
function extractSearchQueries(content: string): string[] {
  const queries: string[] = [];
  let match;
  while ((match = SEARCH_PATTERN.exec(content)) !== null) {
    queries.push(match[1].trim());
  }
  return queries;
}

/**
 * AIの応答から検索パターンを除去し、検索結果への参照に置換
 */
function replaceSearchPatterns(content: string): string {
  return content.replace(SEARCH_PATTERN, '');
}

/**
 * 議論を実行するジェネレーター関数
 */
export async function* runDiscussion(
  request: DiscussionRequest
): AsyncGenerator<DiscussionProgress> {
  const {
    topic,
    participants,
    rounds,
    previousTurns,
    searchResults: initialSearchResults,
    searchConfig,
    userProfile,
    discussionMode,
    discussionDepth,
    directionGuide,
    terminationConfig,
    resumeFrom,
    messageVotes,
    skipSummary,
  } = request;

  // 検索結果を動的に更新できるように変数化
  let currentSearchResults: SearchResult[] = initialSearchResults ? [...initialSearchResults] : [];

  // 再開時は既存のメッセージから開始
  const messages: DiscussionMessage[] = resumeFrom?.messages ? [...resumeFrom.messages] : [];
  let messageId = messages.length;
  let terminated = false;
  let terminationReason = '';

  // 再開位置
  const startRound = resumeFrom?.currentRound || 1;
  const startParticipantIndex = resumeFrom?.currentParticipantIndex || 0;

  // 過去のターンの要約を準備（最新5件まで）
  const turnContext = previousTurns?.slice(-5);

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
    const pStartIndex = (round === startRound) ? startParticipantIndex : 0;

    // eachRound検索: ラウンド開始時に検索を実行（2ラウンド目以降、または再開時の最初のラウンドで参加者0から開始の場合）
    const shouldSearchEachRound = searchConfig?.enabled &&
      searchConfig?.timing?.eachRound &&
      ((round > 1 && pStartIndex === 0) || (round === startRound && pStartIndex === 0 && round > 1));

    if (shouldSearchEachRound) {
      yield {
        type: 'searching',
        searchResults: currentSearchResults,
      };

      const searchQuery = searchConfig?.query || topic;
      const newResults = await performSearch(searchQuery, searchConfig);

      if (newResults.length > 0) {
        currentSearchResults = mergeSearchResults(currentSearchResults, newResults);
        // 検索結果をコールバックで通知
        request.onSearchResult?.(currentSearchResults);
      }
      // 検索完了を通知
      yield {
        type: 'search_results',
        searchResults: currentSearchResults,
      };
    }

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

      let prompt = createDiscussionPrompt(
        topic,
        previousMessages,
        messages.length === 0,
        false,
        turnContext,
        currentSearchResults.length > 0 ? currentSearchResults : undefined,
        participant.role,
        participant.customRolePrompt,
        participants,
        participant,
        userProfile,
        discussionMode,
        discussionDepth,
        directionGuide
      );

      // onDemand検索が有効な場合、検索リクエスト機能の説明を追加
      if (searchConfig?.enabled && searchConfig?.timing?.onDemand) {
        prompt += `\n\n【Web検索リクエスト機能】
議論中に最新の情報が必要な場合、{{SEARCH:検索クエリ}} の形式で検索をリクエストできます。
例: {{SEARCH:React 19 新機能}}
検索結果は次の発言者に共有されます。`;
      }

      // メッセージIDを事前に生成
      const newMessageId = `msg-${++messageId}`;

      // ストリーミング対応プロバイダーの場合はストリーミングを使用
      let response;
      if (provider.generateStream && request.onMessageChunk) {
        let accumulatedContent = '';
        response = await provider.generateStream({ prompt }, (chunk) => {
          accumulatedContent += chunk;
          request.onMessageChunk!(newMessageId, chunk, accumulatedContent, participant.provider, participant.model, round);
        });
      } else {
        response = await provider.generate({ prompt });
      }

      if (response.error) {
        yield {
          type: 'error',
          error: `${participant.displayName}: ${response.error}`,
        };
        continue;
      }

      // onDemand検索: AIの応答から{{SEARCH:query}}パターンを検出
      let messageContent = response.content;
      if (searchConfig?.enabled && searchConfig?.timing?.onDemand) {
        const searchQueries = extractSearchQueries(response.content);
        if (searchQueries.length > 0) {
          // 検索中を通知
          yield {
            type: 'searching',
            searchResults: currentSearchResults,
          };

          // 各クエリで検索を実行
          for (const query of searchQueries) {
            const newResults = await performSearch(query, searchConfig);
            if (newResults.length > 0) {
              currentSearchResults = mergeSearchResults(currentSearchResults, newResults);
            }
          }

          // 検索結果をコールバックで通知
          request.onSearchResult?.(currentSearchResults);

          // 検索完了を通知
          yield {
            type: 'search_results',
            searchResults: currentSearchResults,
          };

          // メッセージから検索パターンを除去
          messageContent = replaceSearchPatterns(response.content).trim();
        }
      }

      const message: DiscussionMessage = {
        id: newMessageId,
        participantId: participant.id, // 参加者への参照
        provider: participant.provider,
        model: participant.model,
        content: messageContent,
        round,
        timestamp: new Date(),
        prompt,
        // 表示用情報のスナップショット（永続化・履歴表示用）
        displayName: formatParticipantDisplayName(participant),
        displayRoleName: participant.displayRoleName,
        color: participant.color,
      };

      messages.push(message);

      yield {
        type: 'message',
        message,
      };

      // 終了条件のチェック（ラウンド終了後）
      if (pIndex === participants.length - 1) {
        const termResult = checkTerminationConditions(messages, message, termConfig);
        if (termResult.terminated) {
          terminated = true;
          terminationReason = termResult.reason;
          yield {
            type: 'terminated',
            terminationReason,
          };
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

  // skipSummaryがtrueの場合、統合回答生成をスキップ
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

  // 統合回答を生成
  yield* generateSummary(messages, participants, topic, rounds, turnContext, currentSearchResults.length > 0 ? currentSearchResults : undefined, userProfile, discussionMode, discussionDepth, directionGuide, messageVotes);
}

/**
 * 終了条件をチェック
 */
function checkTerminationConditions(
  messages: DiscussionMessage[],
  lastMessage: DiscussionMessage,
  termConfig: TerminationConfig
): { terminated: boolean; reason: string } {
  // 合意形成による終了
  if (termConfig.condition === 'consensus') {
    const threshold = termConfig.consensusThreshold || 0.7;
    if (checkConsensus(messages, threshold)) {
      return { terminated: true, reason: '参加者間で合意が形成されました' };
    }
  }

  // キーワードによる終了
  if (termConfig.condition === 'keyword' && termConfig.terminationKeywords) {
    if (checkTerminationKeywords(lastMessage.content, termConfig.terminationKeywords)) {
      return { terminated: true, reason: '終了キーワードが検出されました' };
    }
  }

  return { terminated: false, reason: '' };
}

/**
 * 統合回答を生成
 */
async function* generateSummary(
  messages: DiscussionMessage[],
  participants: DiscussionParticipant[],
  topic: string,
  rounds: number,
  turnContext: { topic: string; finalAnswer: string }[] | undefined,
  searchResults: import('@/types').SearchResult[] | undefined,
  userProfile: UserProfile | undefined,
  discussionMode: import('@/types').DiscussionMode | undefined,
  discussionDepth: import('@/types').DiscussionDepth | undefined,
  directionGuide: import('@/types').DirectionGuide | undefined,
  messageVotes: import('@/types').MessageVote[] | undefined
): AsyncGenerator<DiscussionProgress> {
  // 統合中の進捗を送信
  yield {
    type: 'progress',
    progress: {
      currentRound: rounds,
      totalRounds: rounds,
      currentParticipantIndex: participants.length - 1,
      totalParticipants: participants.length,
      currentParticipant: participants[0],
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

    const summaryPrompt = createDiscussionPrompt(
      topic,
      allMessages,
      false,
      true,
      turnContext,
      searchResults,
      undefined,
      undefined,
      participants,
      undefined,
      userProfile,
      discussionMode,
      discussionDepth,
      directionGuide,
      messageVotes
    );
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
    yield* generateFollowUps(successfulParticipants, topic, summaryContent, userProfile);
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

/**
 * フォローアップ質問を生成
 */
async function* generateFollowUps(
  successfulParticipants: DiscussionParticipant[],
  topic: string,
  summaryContent: string,
  userProfile: UserProfile | undefined
): AsyncGenerator<DiscussionProgress> {
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
}
