import { NextRequest } from 'next/server';
import { DiscussionParticipant, UserProfile } from '@/types';
import { createProvider, createFollowUpPrompt, parseFollowUpResponse } from '@/lib/ai-providers';
import { logger } from '@/lib/logger';

const log = logger.api.child({ route: '/api/followups' });

interface FollowupsRequest {
  topic: string;
  finalAnswer: string;
  participants: DiscussionParticipant[];
  userProfile?: UserProfile;
}

export async function POST(request: NextRequest) {
  try {
    const body: FollowupsRequest = await request.json();

    if (!body.topic || !body.finalAnswer || !body.participants || body.participants.length === 0) {
      log.warn('Missing required parameters');
      return Response.json(
        { error: 'Topic, finalAnswer, and participants are required' },
        { status: 400 }
      );
    }

    const { topic, finalAnswer, participants, userProfile } = body;

    log.info('Followups request received', { topic, participantCount: participants.length });

    // Server-Sent Events を使用してリアルタイム更新
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // フォローアップ質問を生成
          const followUpProvider = participants[0];
          if (followUpProvider) {
            const provider = createProvider(followUpProvider.provider, followUpProvider.model);
            const followUpPromptText = createFollowUpPrompt(topic, finalAnswer, userProfile);
            const followUpResponse = await provider.generate({ prompt: followUpPromptText });

            if (!followUpResponse.error && followUpResponse.content) {
              const followUpQuestions = parseFollowUpResponse(followUpResponse.content);
              if (followUpQuestions.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'followups',
                  suggestedFollowUps: followUpQuestions,
                })}\n\n`));
              }
            } else {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: `Follow-up generation failed: ${followUpResponse.error}`,
              })}\n\n`));
            }
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
    log.error('Followups request failed', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
