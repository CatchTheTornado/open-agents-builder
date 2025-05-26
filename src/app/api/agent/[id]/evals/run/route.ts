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

interface ConversationFlow {
  messages: ChatMessage[];
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

async function evaluateResult(actualResult: string, expectedResult: string, conversationFlow: ConversationFlow): Promise<{
  isCompliant: boolean;
  explanation: string;
  score: number;
}> {
  const result = await generateObject({
    model: llmProviderSetup(),
    maxTokens: 1000,
    temperature: 0.2,
    schema: evaluationSchema,
    prompt: `Evaluate if the conversation flow and final result matches the expected result. Consider:
    1. Semantic meaning and intent
    2. Completeness of the response
    3. Format and structure (if relevant)
    4. The entire conversation flow and context

    Conversation Flow:
    ${conversationFlow.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

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
              // Send initial status update
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: 'test_case_update',
                    data: {
                      ...testCase,
                      status: 'running'
                    }
                  }) + '\n'
                )
              );

              const messages = [...testCase.messages];
              let error: string | undefined;
              const conversationFlow: ConversationFlow = { messages: [] };

              // Process each message in sequence
              for (let i = 0; i < messages.length; i++) {
                try {
                  let collectedContent = '';
                  const toolCalls: { name: string; arguments: Record<string, unknown> }[] = [];
                  

                  // Send TX status for user message
                  if (messages[i].role === 'user') {
                    // Add the current message to the conversation flow
                    conversationFlow.messages.push({
                        role: messages[i].role,
                        content: messages[i].content
                    });


                    controller.enqueue(
                      new TextEncoder().encode(
                        JSON.stringify({
                          type: 'test_case_update',
                          data: {
                            ...testCase,
                            status: 'TX',
                            statusColor: 'brown',
                            statusSpinner: true,
                            conversationFlow: {
                              messages: [...conversationFlow.messages]
                            },
                            sessionId
                          }
                        }) + '\n'
                      )
                    );

                    console.log(conversationFlow.messages)

                    // Send the entire conversation history up to this point
                    await client.chat.streamChatWithCallbacks(
                        conversationFlow.messages,
                        {
                          agentId,
                          sessionId,
                          onText: (text) => {
                            collectedContent += text;
                            // Send RX status with intermediate updates
                            controller.enqueue(
                              new TextEncoder().encode(
                                JSON.stringify({
                                  type: 'test_case_update',
                                  data: {
                                    ...testCase,
                                    status: 'RX',
                                    statusColor: 'green',
                                    statusSpinner: true,
                                    conversationFlow: {
                                      messages: [
                                        ...conversationFlow.messages,
                                        {
                                          role: 'assistant',
                                          content: collectedContent,
                                          toolCalls: toolCalls.length > 0 ? toolCalls : undefined
                                        }
                                      ]
                                    },
                                    sessionId
                                  }
                                }) + '\n'
                              )
                            );
                          },
                          onToolCall: (toolCall) => {
                            toolCalls.push(toolCall);
                          },
                          onError: (err) => {
                            error = err;
                            console.error(err);
                          }
                        }                        
                    );

                    if (error) {
                      throw new Error(error);
                    }

                    // Add the assistant's response to the conversation flow
                    conversationFlow.messages.push({
                      role: 'assistant',
                      content: collectedContent,
                      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
                    });
                  }

                  // Update the messages array with the latest response
//                  messages = [...conversationFlow.messages];
                } catch (err) {
                  error = err instanceof Error ? err.message : String(err);
                  throw err;
                }
              }

              if (!conversationFlow.messages.length) {
                throw new Error('No response received from the agent');
              }

              const actualResult = conversationFlow.messages[conversationFlow.messages.length - 1].content;
              const evaluation = await evaluateResult(actualResult, testCase.expectedResult, conversationFlow);

              // Send the final test case update through the stream
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: 'test_case_update',
                    data: {
                      ...testCase,
                      status: evaluation.score >= 0.75 ? 'completed' : 
                             evaluation.score >= 0.5 ? 'warning' : 'failed',
                      actualResult,
                      evaluation,
                      conversationFlow,
                      sessionId
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
                      sessionId
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