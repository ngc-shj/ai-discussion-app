/**
 * AI発言生成API
 *
 * 単一の参加者のAI発言を生成し、SSEでストリーミング返却する。
 * クライアント側オーケストレーション用の新API。
 */
import { NextRequest } from 'next/server';
import {
  DiscussionMessage,
  DiscussionParticipant,
  PreviousTurnSummary,
  SearchResult,
  ROLE_PRESETS,
  UserProfile,
  DiscussionMode,
  DiscussionDepth,
  DirectionGuide,
  formatParticipantDisplayName,
} from '@/types';
import { createProvider, createDiscussionPrompt } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

const log = logger.api.child({ route: '/api/ai-generate' });

/**
 * AI応答から{{SEARCH:query}}パターンを抽出
 */
function extractSearchQueries(content: string): string[] {
  const pattern = /\{\{SEARCH:([^}]+)\}\}/g;
  const queries: string[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const query = match[1].trim();
    if (query) {
      queries.push(query);
    }
  }
  return queries;
}

interface AIGenerateRequest {
  // 発言する参加者
  participant: DiscussionParticipant;
  // 議論トピック
  topic: string;
  // 現在のラウンド
  round: number;
  // これまでのメッセージ
  previousMessages: DiscussionMessage[];
  // 全参加者リスト（プロンプト生成用）
  participants: DiscussionParticipant[];
  // 検索結果（オプション）
  searchResults?: SearchResult[];
  // 過去のターン要約（オプション）
  previousTurns?: PreviousTurnSummary[];
  // ユーザープロフィール（オプション）
  userProfile?: UserProfile;
  // 議論モード（オプション）
  discussionMode?: DiscussionMode;
  // 議論の深さ（オプション）
  discussionDepth?: DiscussionDepth;
  // 方向性ガイド（オプション）
  directionGuide?: DirectionGuide;
  // onDemand検索を有効にするか
  enableOnDemandSearch?: boolean;
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

export async function POST(request: NextRequest) {
  try {
    const body: AIGenerateRequest = await request.json();

    if (!body.topic || !body.participant || !body.participants) {
      log.warn('Missing required parameters');
      return Response.json(
        { error: 'Topic, participant, and participants are required' },
        { status: 400 }
      );
    }

    const {
      participant,
      topic,
      round,
      previousMessages,
      participants,
      searchResults,
      previousTurns,
      userProfile,
      discussionMode,
      discussionDepth,
      directionGuide,
      enableOnDemandSearch,
    } = body;

    log.info('AI generate request received', {
      topic,
      participant: participant.displayName,
      round,
      previousMessageCount: previousMessages?.length || 0,
    });

    // 過去のターンの要約を準備（最新5件まで）
    const turnContext = previousTurns?.slice(-5);

    // Server-Sent Events を使用してリアルタイム更新
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const provider = createProvider(participant.provider, participant.model);
          const isAvailable = await provider.isAvailable();

          if (!isAvailable) {
            log.warn('Provider not available', {
              participant: participant.displayName,
              provider: participant.provider,
              model: participant.model,
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: `${participant.displayName} is not available`,
            })}\n\n`));
            controller.close();
            return;
          }

          // プロンプトを生成
          const formattedMessages = (previousMessages || []).map((m) => {
            const msgParticipant = participants.find(
              (p) => p.provider === m.provider && p.model === m.model
            );
            const rolePreset = msgParticipant?.role
              ? ROLE_PRESETS.find((r) => r.id === msgParticipant.role)
              : undefined;
            return {
              provider: m.model
                ? `${getProviderDisplayName(m.provider)} (${m.model})`
                : getProviderDisplayName(m.provider),
              content: m.content,
              role: rolePreset?.name,
            };
          });

          let prompt = createDiscussionPrompt(
            topic,
            formattedMessages,
            (previousMessages || []).length === 0,
            false,
            turnContext,
            searchResults && searchResults.length > 0 ? searchResults : undefined,
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
          if (enableOnDemandSearch) {
            prompt += `\n\n【オプション: Web検索機能】
議論中に追加の情報が必要な場合、回答の中で {{SEARCH:検索クエリ}} と記述すると、Web検索をリクエストできます。
例: {{SEARCH:React 19 新機能}}

※検索は任意です。まずは回答を作成し、必要に応じて検索をリクエストしてください。
※検索結果は次の発言者に共有されます。`;
          }

          // メッセージIDを生成
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          // ストリーミング対応プロバイダーの場合はストリーミングを使用
          let accumulatedContent = '';
          if (provider.generateStream) {
            try {
              const response = await provider.generateStream(
                { prompt },
                (chunk: string) => {
                  accumulatedContent += chunk;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'message_chunk',
                    messageId,
                    chunk,
                    accumulatedContent,
                    provider: participant.provider,
                    model: participant.model,
                    round,
                  })}\n\n`));
                }
              );

              if (response.error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: `${participant.displayName}: ${response.error}`,
                })}\n\n`));
              } else {
                // 完成したメッセージを送信
                const finalContent = response.content || accumulatedContent;
                const message: DiscussionMessage = {
                  id: messageId,
                  participantId: participant.id,
                  provider: participant.provider,
                  model: participant.model,
                  content: finalContent,
                  round,
                  timestamp: new Date(),
                  prompt,
                  displayName: formatParticipantDisplayName(participant),
                  displayRoleName: participant.displayRoleName,
                  color: participant.color,
                };

                // onDemand検索が有効な場合、検索クエリを抽出
                const searchQueries = enableOnDemandSearch ? extractSearchQueries(finalContent) : [];

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'message',
                  message,
                  ...(searchQueries.length > 0 && { searchQueries }),
                })}\n\n`));
              }
            } catch (streamError) {
              log.warn('Streaming failed, falling back to non-streaming', { error: streamError });
              // ストリーミングに失敗した場合は通常の生成にフォールバック
              const response = await provider.generate({ prompt });

              if (response.error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: `${participant.displayName}: ${response.error}`,
                })}\n\n`));
              } else {
                const message: DiscussionMessage = {
                  id: messageId,
                  participantId: participant.id,
                  provider: participant.provider,
                  model: participant.model,
                  content: response.content,
                  round,
                  timestamp: new Date(),
                  prompt,
                  displayName: formatParticipantDisplayName(participant),
                  displayRoleName: participant.displayRoleName,
                  color: participant.color,
                };

                // onDemand検索が有効な場合、検索クエリを抽出
                const searchQueries = enableOnDemandSearch ? extractSearchQueries(response.content) : [];

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'message',
                  message,
                  ...(searchQueries.length > 0 && { searchQueries }),
                })}\n\n`));
              }
            }
          } else {
            // ストリーミング非対応の場合は従来の方法で生成
            const response = await provider.generate({ prompt });

            if (response.error) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: `${participant.displayName}: ${response.error}`,
              })}\n\n`));
            } else {
              const message: DiscussionMessage = {
                id: messageId,
                participantId: participant.id,
                provider: participant.provider,
                model: participant.model,
                content: response.content,
                round,
                timestamp: new Date(),
                prompt,
                displayName: formatParticipantDisplayName(participant),
                displayRoleName: participant.displayRoleName,
                color: participant.color,
              };

              // onDemand検索が有効な場合、検索クエリを抽出
              const searchQueries = enableOnDemandSearch ? extractSearchQueries(response.content) : [];

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'message',
                message,
                ...(searchQueries.length > 0 && { searchQueries }),
              })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          log.error('AI generation failed', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    log.error('AI generate request failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
