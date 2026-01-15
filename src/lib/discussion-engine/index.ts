import { DiscussionMessage, DiscussionParticipant, TerminationConfig, ROLE_PRESETS, UserProfile, SearchResult, SearchConfig, formatParticipantDisplayName, formatTopicForDisplay, LOG_TOPIC_MAX_LENGTH } from '@/types';
import { createProvider, createDiscussionPrompt, createFollowUpPrompt, parseFollowUpResponse } from '../ai-providers';
import { createSearchKeywordPrompt, SearchKeywordTiming } from '../ai-providers/prompt-formatters';
import { DiscussionSSEEvent, DiscussionRequest, getProviderDisplayName } from './types';
import { checkConsensus, checkTerminationKeywords } from './termination';
import { performSearch, mergeSearchResults, DefaultAIConfig, SearchContext } from '../search';
import { logger } from '@/lib/logger';

const log = logger.discussion;

// Re-export types
export type { DiscussionSSEEvent, ResumeFromParams, DiscussionRequest } from './types';
export { getProviderDisplayName } from './types';
export { checkConsensus, checkTerminationKeywords } from './termination';

// 検索パターン: {{SEARCH:query}} または {{検索:query}}
const SEARCH_PATTERN = /\{\{(?:SEARCH|検索):(.+?)\}\}/g;

/**
 * AIの応答から検索パターンを抽出
 */
function extractSearchQueries(content: string): string[] {
  const queries: string[] = [];
  // グローバル正規表現のlastIndexをリセット
  SEARCH_PATTERN.lastIndex = 0;
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
 * AIの応答からJSONキーワード配列をパース
 */
function parseKeywordsResponse(content: string): string[] {
  // JSONブロックを抽出（```json ... ``` または 単独の [...] ）
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    content.match(/\[[\s\S]*?\]/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr.trim());
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
    } catch {
      // パース失敗時はフォールバック
    }
  }

  // フォールバック: 行ごとに分割してキーワードを抽出
  const lines = content.split('\n')
    .map(line => line.replace(/^[-*\d.]+\s*/, '').trim())
    .filter(line => line.length > 0 && line.length < 100);

  return lines.slice(0, 5);
}

/**
 * AIを使って検索キーワードを生成
 */
interface GenerateSearchKeywordsResult {
  keywords: string[];
  prompt?: string;
}

async function generateSearchKeywords(
  topic: string,
  messages: DiscussionMessage[],
  timing: SearchKeywordTiming,
  participant: DiscussionParticipant
): Promise<GenerateSearchKeywordsResult> {
  try {
    const provider = createProvider(participant.provider, participant.model);
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      return { keywords: [topic] }; // フォールバック
    }

    const messagesForPrompt = messages.map(m => ({
      provider: m.displayName || `${m.provider}/${m.model}`,
      content: m.content,
    }));

    const prompt = createSearchKeywordPrompt(topic, messagesForPrompt, timing);
    const response = await provider.generate({ prompt });

    if (response.error) {
      return { keywords: [topic], prompt }; // フォールバック
    }

    const keywords = parseKeywordsResponse(response.content);
    return {
      keywords: keywords.length > 0 ? keywords : [topic],
      prompt,
    };
  } catch (error) {
    log.error('Failed to generate search keywords', error, { topic: formatTopicForDisplay(topic, LOG_TOPIC_MAX_LENGTH), timing });
    return { keywords: [topic] }; // フォールバック
  }
}

/**
 * 議論を実行するジェネレーター関数
 */
export async function* runDiscussion(
  request: DiscussionRequest
): AsyncGenerator<DiscussionSSEEvent> {
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

  const startTime = Date.now();
  log.info('Discussion started', { topic: formatTopicForDisplay(topic, LOG_TOPIC_MAX_LENGTH), participantCount: participants.length, rounds, resumeFrom: !!resumeFrom });

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
  const effectiveMaxRounds = Math.min(rounds, termConfig.maxRounds);

  // 各ラウンドで全参加者が発言
  for (let round = startRound; round <= effectiveMaxRounds && !terminated; round++) {
    const pStartIndex = (round === startRound) ? startParticipantIndex : 0;

    // eachRound検索: ラウンド開始時に検索を実行
    // - 通常: 2ラウンド目以降、参加者0から開始の場合
    // - 再開時: searchTiming === 'round' で中断されたラウンドの場合、検索を再実行（pStartIndexに関係なく）
    const isResumedRoundSearch = round === startRound && resumeFrom?.searchTiming === 'round';
    const shouldSearchEachRound = searchConfig?.enabled &&
      searchConfig?.timing?.eachRound &&
      ((round > 1 && pStartIndex === 0) || isResumedRoundSearch);

    if (shouldSearchEachRound) {
      yield {
        type: 'searching',
        searchResults: currentSearchResults,
        searchTiming: 'round' as const,
        searchRound: round,
      };

      // 直前のラウンドのメッセージを取得
      const previousRoundMessages = messages.filter(m => m.round === round - 1);

      // AIにキーワードを生成させる
      const { keywords: searchKeywords, prompt: keywordPrompt } = await generateSearchKeywords(
        topic,
        previousRoundMessages.length > 0 ? previousRoundMessages : messages,
        'round',
        participants[0]
      );

      // 検索キーワード情報を通知
      yield {
        type: 'search_keywords',
        searchKeywords: {
          timing: 'round',
          round: round,
          keywords: searchKeywords,
          prompt: keywordPrompt,
          timestamp: new Date(),
        },
      };

      // 各キーワードで検索（topicを渡して関連性フィルタリングを有効化）
      // 関連性フィルタリング用のデフォルトAI設定（最初の参加者のプロバイダー/モデルを使用）
      const defaultAI: DefaultAIConfig = {
        provider: participants[0].provider,
        model: participants[0].model,
      };
      // このラウンドで新しく取得した検索結果を追跡
      let roundSearchResults: SearchResult[] = [];
      for (let kwIndex = 0; kwIndex < searchKeywords.length; kwIndex++) {
        const keyword = searchKeywords[kwIndex];

        // 検索進捗を通知
        yield {
          type: 'search_progress',
          searchProgress: {
            currentKeywordIndex: kwIndex,
            totalKeywords: searchKeywords.length,
            currentKeyword: keyword,
          },
        };

        // ラウンド検索用のコンテキスト
        const roundSearchContext: SearchContext = {
          timing: 'round',
          searchKeywords: searchKeywords,
        };
        const { results: newResults } = await performSearch(keyword, searchConfig, topic, defaultAI, roundSearchContext);
        if (newResults.length > 0) {
          // このラウンドの結果に追加（重複除去）
          const existingUrls = new Set(roundSearchResults.map(r => r.url));
          const uniqueNewResults = newResults.filter(r => !existingUrls.has(r.url));
          roundSearchResults = [...roundSearchResults, ...uniqueNewResults];
        }

        // 完了を通知
        yield {
          type: 'search_progress',
          searchProgress: {
            currentKeywordIndex: kwIndex,
            totalKeywords: searchKeywords.length,
            currentKeyword: keyword,
            completedKeyword: keyword,
          },
        };
      }

      // このラウンドの検索結果をmaxResultsで制限
      roundSearchResults = roundSearchResults.slice(0, searchConfig.maxResults);

      // 制限後の結果を全体の累積結果にマージ
      currentSearchResults = mergeSearchResults(currentSearchResults, roundSearchResults);

      // 検索結果をコールバックで通知（全体の累積結果）
      if (currentSearchResults.length > 0) {
        request.onSearchResult?.(currentSearchResults);
      }

      // 検索完了を通知（このラウンドの結果のみ、UI表示用）
      // searchResultsAccumulatedは全体の累積結果（プロンプト生成用）
      yield {
        type: 'search_results',
        searchResults: roundSearchResults,
        searchResultsAccumulated: currentSearchResults,
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
        log.warn('Provider not available', { participant: participant.displayName, provider: participant.provider, model: participant.model });
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
        prompt += `\n\n【オプション: Web検索機能】
議論中に追加の情報が必要な場合、回答の中で {{SEARCH:検索クエリ}} と記述すると、Web検索をリクエストできます。
例: {{SEARCH:React 19 新機能}}

※検索は任意です。まずは回答を作成し、必要に応じて検索をリクエストしてください。
※検索結果は次の発言者に共有されます。`;
      }

      // メッセージIDを事前に生成
      const newMessageId = `msg-${++messageId}`;

      // ストリーミング対応プロバイダーの場合はストリーミングを使用
      let response;
      let streamedContent = '';
      if (provider.generateStream && request.onMessageChunk) {
        response = await provider.generateStream({ prompt }, (chunk) => {
          streamedContent += chunk;
          request.onMessageChunk!(newMessageId, chunk, streamedContent, participant.provider, participant.model, round);
        });
        // ストリーミング完了後、蓄積したコンテンツをresponseに設定
        // response.contentが空文字列の場合も含めて置き換える
        if (streamedContent) {
          response = { ...response, content: streamedContent };
        }
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

          // 各クエリで検索を実行（topicを渡して関連性フィルタリングを有効化）
          // 関連性フィルタリング用のデフォルトAI設定（最初の参加者のプロバイダー/モデルを使用）
          const onDemandDefaultAI: DefaultAIConfig = {
            provider: participants[0].provider,
            model: participants[0].model,
          };
          // オンデマンド検索用のコンテキスト（議論中の検索なのでroundとして扱う）
          const onDemandSearchContext: SearchContext = {
            timing: 'round',
            searchKeywords: searchQueries,
          };
          for (const query of searchQueries) {
            const { results: newResults } = await performSearch(query, searchConfig, topic, onDemandDefaultAI, onDemandSearchContext);
            if (newResults.length > 0) {
              currentSearchResults = mergeSearchResults(currentSearchResults, newResults);
            }
          }

          // maxResultsで検索結果を制限
          if (searchConfig.maxResults && currentSearchResults.length > searchConfig.maxResults) {
            currentSearchResults = currentSearchResults.slice(0, searchConfig.maxResults);
          }

          // 検索結果をコールバックで通知
          request.onSearchResult?.(currentSearchResults);

          // 検索完了を通知
          yield {
            type: 'search_results',
            searchResults: currentSearchResults,
          };

          // メッセージから検索パターンを除去
          const cleanedContent = replaceSearchPatterns(response.content).trim();
          // 空にならないように元のコンテンツを保持
          messageContent = cleanedContent || response.content;
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
    log.error('All providers failed', new Error('No messages generated'), { providers: providerNames });
    yield {
      type: 'error',
      error: `No messages were generated. All providers failed (${providerNames}).`,
    };
    return;
  }

  // skipSummaryがtrueの場合、統合回答生成をスキップ
  if (skipSummary) {
    const duration = Date.now() - startTime;
    log.info('Discussion completed (skip summary)', { topic: formatTopicForDisplay(topic, LOG_TOPIC_MAX_LENGTH), messageCount: messages.length, duration });
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

  const duration = Date.now() - startTime;
  log.info('Discussion completed', { topic: formatTopicForDisplay(topic, LOG_TOPIC_MAX_LENGTH), messageCount: messages.length, duration });
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
): AsyncGenerator<DiscussionSSEEvent> {
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
): AsyncGenerator<DiscussionSSEEvent> {
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
    log.warn('Failed to generate follow-up questions', { error });
  }
}
