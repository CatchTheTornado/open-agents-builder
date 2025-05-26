import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { TestCase } from '@/data/client/agent-api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: {
    name: string;
    arguments: Record<string, unknown>;
  }[];
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
                sessionId: response?.sessionId
              });

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

          return {
            ...testCase,
            status: 'completed',
            actualResult: response.messages[response.messages.length - 1].content
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