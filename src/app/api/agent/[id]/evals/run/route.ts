import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { TestCase } from '@/data/client/agent-api-client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { testCases } = await request.json();
    const agentId = params.id;

    const client = new OpenAgentsBuilderClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL,
      databaseIdHash: process.env.DATABASE_ID_HASH || '',
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    const updatedTestCases = await Promise.all(
      testCases.map(async (testCase: TestCase) => {
        try {
          let messages = [...testCase.messages];
          let response: { messages: TestCase['messages']; sessionId?: string } | undefined;

          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user') {
              response = await client.chat.collectMessages(messages.slice(0, i + 1), {
                agentId,
                sessionId: response?.sessionId
              });
              messages = response.messages;
            }
          }

          return {
            ...testCase,
            status: 'completed',
            actualResult: response?.messages[response.messages.length - 1].content
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