import { NextRequest } from 'next/server';
import { DiscussionMessage, DiscussionParticipant, PreviousTurnSummary, SearchResult, ROLE_PRESETS, UserProfile, DiscussionMode, DiscussionDepth, DirectionGuide, MessageVote } from '@/types';
import { createProvider, createDiscussionPrompt, createFollowUpPrompt, parseFollowUpResponse } from '@/lib/ai-providers';

interface SummarizeRequest {
  topic: string;
  participants: DiscussionParticipant[];
  messages: DiscussionMessage[];
  previousTurns?: PreviousTurnSummary[];
  searchResults?: SearchResult[];
  userProfile?: UserProfile;
  discussionMode?: DiscussionMode;
  discussionDepth?: DiscussionDepth;
  directionGuide?: DirectionGuide;
  messageVotes?: MessageVote[];
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
    const body: SummarizeRequest = await request.json();

    if (!body.topic || !body.participants || body.participants.length === 0 || !body.messages || body.messages.length === 0) {
      return Response.json(
        { error: 'Topic, participants, and messages are required' },
        { status: 400 }
      );
    }

    const { topic, participants, messages, previousTurns, searchResults, userProfile, discussionMode, discussionDepth, directionGuide, messageVotes } = body;

    // 過去のターンの要約を準備（最新5件まで）
    const turnContext: PreviousTurnSummary[] | undefined = previousTurns?.slice(-5);

    // Server-Sent Events を使用してリアルタイム更新
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 統合中の進捗を送信（summaryStateで管理されるためprogressは空）
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            progress: {},
          })}\n\n`));

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
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: `Summary generation failed with ${participant.displayName}: ${summaryResponse.error}`,
              })}\n\n`));
            }
          }

          if (summaryContent) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'summary',
              finalAnswer: summaryContent,
              summaryPrompt: usedSummaryPrompt,
            })}\n\n`));

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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'followups',
                      suggestedFollowUps: followUpQuestions,
                    })}\n\n`));
                  }
                }
              }
            } catch (error) {
              console.error('Failed to generate follow-up questions:', error);
            }
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'Failed to generate summary with all available providers',
            })}\n\n`));
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
