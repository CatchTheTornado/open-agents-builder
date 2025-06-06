import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { generateObject } from 'ai';
import { z } from 'zod';
import { llmProviderSetup } from '@/lib/llm-provider';
import { nanoid } from 'nanoid';
import { authorizeRequestContext } from '@/lib/authorization-api';
import { precheckAPIRequest } from '@/lib/middleware-precheck-api';
import { renderPrompt, getLocale } from '@/lib/templates';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  }[];
}

interface ConversationFlow {
  messages: ChatMessage[];
  toolCalls?: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  }[];
}

const evaluationSchema = z.object({
  isCompliant: z.boolean(),
  explanation: z.string(),
  score: z.number().min(0).max(1)
});

async function evaluateResult(actualResult: string, expectedResult: string, conversationFlow: ConversationFlow, request: Request): Promise<{
  isCompliant: boolean;
  explanation: string;
  score: number;
}> {
  const locale = getLocale(request);
  
  // Pre-process data for the template
  const conversationFlowText = conversationFlow.messages
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
  
  const toolCallsText = conversationFlow.toolCalls 
    ? JSON.stringify(conversationFlow.toolCalls, null, 2)
    : '';

  const prompt = await renderPrompt(locale, 'eval-run', {
    conversationFlowText,
    expectedResult,
    actualResult,
    toolCallsText
  });
    
  const result = await generateObject({
    model: llmProviderSetup(),
    maxTokens: 1000,
    temperature: 0.2,
    schema: evaluationSchema,
    prompt
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
                  // Store tool calls and results in a single array
                  const mergedToolCalls: { toolCallId: string; toolName: string; args: Record<string, unknown>; result: unknown }[] = [];
                  

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

                    // Send the entire conversation history up to this point
                    await client.chat.streamChatWithCallbacks(
                        conversationFlow.messages,
                        {
                          agentId,
                          sessionId,
                          onText: (text) => {
                            collectedContent += text;
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
                                          toolCalls: mergedToolCalls.length > 0 ? mergedToolCalls : undefined
                                        }
                                      ],
                                      toolCalls: mergedToolCalls.length > 0 ? mergedToolCalls : undefined
                                    },
                                    sessionId
                                  }
                                }) + '\n'
                              )
                            );
                          },
                          onToolCall: (toolCall) => {
                            mergedToolCalls.push({ ...toolCall, result: undefined });
                          },
                          onToolResult: (toolCallResult) => {
                            const idx = mergedToolCalls.findIndex(tc => tc.toolCallId === toolCallResult.toolCallId);
                            if (idx !== -1) {
                              mergedToolCalls[idx].result = toolCallResult.result;
                            } else {
                              mergedToolCalls.push({
                                toolCallId: toolCallResult.toolCallId,
                                toolName: '',
                                args: {},
                                result: toolCallResult.result
                              });
                            }
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
                      toolCalls: mergedToolCalls.length > 0 ? mergedToolCalls : undefined
                    });
                    conversationFlow.toolCalls = mergedToolCalls.length > 0 ? mergedToolCalls : undefined;
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
              const evaluation = await evaluateResult(actualResult, testCase.expectedResult, conversationFlow, request);

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