import { NextRequest } from 'next/server';
import { runDiscussion, DiscussionRequest } from '@/lib/discussion-engine';

export async function POST(request: NextRequest) {
  try {
    const body: DiscussionRequest = await request.json();

    if (!body.topic || !body.participants || body.participants.length === 0) {
      return Response.json(
        { error: 'Topic and at least one participant are required' },
        { status: 400 }
      );
    }

    const rounds = body.rounds || 2;

    // Server-Sent Events を使用してリアルタイム更新
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendSSE = (data: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          for await (const progress of runDiscussion({
            topic: body.topic,
            participants: body.participants,
            rounds,
            previousTurns: body.previousTurns,
            searchResults: body.searchResults,
            searchConfig: body.searchConfig,
            userProfile: body.userProfile,
            discussionMode: body.discussionMode,
            discussionDepth: body.discussionDepth,
            directionGuide: body.directionGuide,
            terminationConfig: body.terminationConfig,
            resumeFrom: body.resumeFrom,
            messageVotes: body.messageVotes,
            skipSummary: body.skipSummary,
            onMessageChunk: (messageId, chunk, accumulatedContent, provider, model, round) => {
              sendSSE({
                type: 'message_chunk',
                messageId,
                chunk,
                accumulatedContent,
                provider,
                model,
                round,
              });
            },
            onSearchResult: (results) => {
              sendSSE({
                type: 'search_results',
                searchResults: results,
              });
            },
          })) {
            sendSSE(progress);
          }
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
