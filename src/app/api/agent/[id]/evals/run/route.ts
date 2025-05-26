import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { generateObject } from 'ai';
import { z } from 'zod';
import { llmProviderSetup } from '@/lib/llm-provider';
import { nanoid } from 'nanoid';
import { authorizeRequestContext } from '@/lib/authorization-api';
import { precheckAPIRequest } from '@/lib/middleware-precheck-api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: {
    name: string;
    arguments: Record<string, unknown>;
  }[];
}

const evaluationSchema = z.object({
  isCompliant: z.boolean(),
  explanation: z.string(),
  score: z.number().min(0).max(1)
});

async function evaluateResult(actualResult: string, expectedResult: string): Promise<{
  isCompliant: boolean;
  explanation: string;
  score: number;
}> {
  const result = await generateObject({
    model: llmProviderSetup(),
    maxTokens: 1000,
    temperature: 0.2,
    schema: evaluationSchema,
    prompt: `Evaluate if the actual result matches the expected result. Consider:
    1. Semantic meaning and intent
    2. Completeness of the response
    3. Format and structure (if relevant)

    Expected Result: ${expectedResult}
    Actual Result: ${actualResult}

    The most important factor is expected result. If the actual result is not as expected, the score should be 0.

    Provide a score from 0 to 1 and explain your reasoning - include the score and expected result in the response.`
  });

  return result.object;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
  response: NextResponse
) {
  try {
    const requestContext = await authorizeRequestContext(request, response);
    const { jwtToken } = await precheckAPIRequest(request as NextRequest);

    const { testCases } = await request.json();
    const agentId = params.id;

    const client = new OpenAgentsBuilderClient({
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      databaseIdHash: requestContext.databaseIdHash,
      apiKey: jwtToken
    });

    // Generate a single sessionId for all test cases
    const sessionId = nanoid();

    // Create a stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const testCase of testCases) {
            try {
              let messages = [...testCase.messages];
              let response: { messages: ChatMessage[]; sessionId?: string } | undefined;
              let error: string | undefined;

              for (let i = 0; i < messages.length; i++) {
                if (messages[i].role === 'user') {
                  try {
                    // Use streamChatWithCallbacks instead of collectMessages
                    let collectedContent = '';
                    await client.chat.streamChatWithCallbacks(
                      messages.slice(0, i + 1),
                      {
                        agentId,
                        sessionId, // Reuse the same sessionId
                        onText: (text) => {
                          collectedContent += text;
                        },
                        onError: (err) => {
                          error = err;
                        }
                      }
                    );

                    if (error) {
                      throw new Error(error);
                    }

                    // Convert the response to our expected format
                    const convertedMessages = [
                      ...messages.slice(0, i),
                      { role: 'assistant', content: collectedContent }
                    ];

                    response = {
                      messages: convertedMessages,
                      sessionId // Include the sessionId in the response
                    };
                    messages = convertedMessages;
                  } catch (err) {
                    error = err instanceof Error ? err.message : String(err);
                    throw err;
                  }
                }
              }

              if (!response || !response.messages.length) {
                throw new Error('No response received from the agent');
              }

              const actualResult = response.messages[response.messages.length - 1].content;
              const evaluation = await evaluateResult(actualResult, testCase.expectedResult);

              // Send the updated test case through the stream
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: 'test_case_update',
                    data: {
                      ...testCase,
                      status: 'completed',
                      actualResult,
                      evaluation,
                      sessionId // Include the sessionId in the response
                    }
                  }) + '\n'
                )
              );
            } catch (error) {
              // Send error through the stream
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: 'test_case_error',
                    data: {
                      ...testCase,
                      status: 'failed',
                      error: error instanceof Error ? error.message : String(error),
                      sessionId // Include the sessionId even in error cases
                    }
                  }) + '\n'
                )
              );
            }
          }
        } catch (error) {
          // Send final error if something goes wrong with the stream
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : String(error)
              }) + '\n'
            )
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (error) {
    console.error('Failed to run evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to run evaluations' },
      { status: 500 }
    );
  }
} 