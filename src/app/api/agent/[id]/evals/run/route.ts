import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { TestCase } from '@/data/client/agent-api-client';
import { generateObject } from 'ai';
import { z } from 'zod';
import { llmProviderSetup } from '@/lib/llm-provider';
import { nanoid } from 'nanoid';

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
    maxTokens: 500,
    temperature: 0.2,
    schema: evaluationSchema,
    prompt: `Evaluate if the actual result matches the expected result. Consider:
    1. Semantic meaning and intent
    2. Completeness of the response
    3. Technical accuracy
    4. Format and structure (if relevant)

    Expected Result: ${expectedResult}
    Actual Result: ${actualResult}

    Provide a score from 0 to 1 and explain your reasoning.`
  });

  return result.object;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { testCases, apiKey } = await request.json();
    const agentId = params.id;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const client = new OpenAgentsBuilderClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL,
      databaseIdHash: process.env.DATABASE_ID_HASH || '',
      apiKey
    });

    const updatedTestCases = await Promise.all(
      testCases.map(async (testCase: TestCase) => {
        try {
          let messages = [...testCase.messages];
          let response: { messages: ChatMessage[]; sessionId?: string } | undefined;

          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user') {
              const chatResponse = await client.chat.collectMessages(messages.slice(0, i + 1), {
                agentId,
                sessionId: nanoid()
              });

              console.log('!!!',chatResponse);

              // Convert the response messages to our expected format
              const convertedMessages = chatResponse.messages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                toolCalls: msg.functionCall ? [{
                  name: msg.functionCall.name,
                  arguments: msg.functionCall.arguments
                }] : undefined
              }));

              response = {
                messages: convertedMessages,
                sessionId: chatResponse.sessionId || undefined
              };
              messages = convertedMessages;
            }
          }

          if (!response || !response.messages.length) {
            throw new Error('No response received from the agent');
          }

          const actualResult = response.messages[response.messages.length - 1].content;
          const evaluation = await evaluateResult(actualResult, testCase.expectedResult);

          return {
            ...testCase,
            status: 'completed',
            actualResult,
            evaluation
          };
        } catch (error) {
          console.error(`Failed to run test case ${testCase.id}:`, error);
          return {
            ...testCase,
            status: 'failed'
          };
        }
      })
    );

    return NextResponse.json({ testCases: updatedTestCases });
  } catch (error) {
    console.error('Failed to run evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to run evaluations' },
      { status: 500 }
    );
  }
} 