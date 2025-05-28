import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authorizeRequestContext } from '@/lib/authorization-api';
import { precheckAPIRequest } from '@/lib/middleware-precheck-api';
import { generateObject } from 'ai';
import { llmProviderSetup } from '@/lib/llm-provider';

const adjustTestCaseSchema = z.object({
  testCaseId: z.string(),
  actualResult: z.string(),
});

const adjustedTestCaseSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    toolCalls: z.array(z.object({
      name: z.string(),
      arguments: z.record(z.unknown())
    })).optional()
  })),
  expectedResult: z.string()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = NextResponse.next();
    const requestContext = await authorizeRequestContext(request, response);
    const { jwtToken } = await precheckAPIRequest(request as NextRequest);
    const body = await request.json();
    const { testCaseId, actualResult } = adjustTestCaseSchema.parse(body);

    const client = new OpenAgentsBuilderClient({
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      databaseIdHash: requestContext.databaseIdHash,
      apiKey: jwtToken
    });

    const sessionId = nanoid();

    // Create a prompt to analyze and adjust the test case
    const prompt = `Given the actual result of a test case, adjust the test case to make it pass. 
    The test case should be modified to expect this result while maintaining its original intent.
    
    Actual Result:
    ${actualResult}
    
    Please provide the adjusted test case in the following JSON format:
    {
      "messages": [
        {
          "role": "user",
          "content": "user message"
        },
        {
          "role": "assistant",
          "content": "assistant response"
        }
      ],
      "expectedResult": "expected result"
    }

    Important requirements:
    1. The messages array MUST contain at least 2 messages - one from the user and one from the assistant
    2. The conversation should be natural and lead to the actual result
    3. The expectedResult should match the actual result
    4. The assistant's response should be meaningful and relevant to the user's message`;

    let collectedContent = '';
    await client.chat.streamChatWithCallbacks(
      [{ role: 'user', content: prompt }],
      {
        agentId: params.id,
        sessionId,
        onText: (text) => {
          collectedContent += text;
        },
        onError: (err) => {
          throw new Error(err);
        }
      }
    );

    if (!collectedContent) {
      throw new Error('No response content received');
    }

    // Parse the response to extract the adjusted test case
    const result = await generateObject({
      model: llmProviderSetup(),
      maxTokens: 1000,
      temperature: 0.2,
      schema: adjustedTestCaseSchema,
      prompt: `Parse the following response into a test case structure. If the response contains JSON, use that. Otherwise, create a test case structure based on the content:

      ${collectedContent}`
    });

    const adjustedTestCase = {
      id: testCaseId,
      messages: result.object.messages,
      expectedResult: result.object.expectedResult,
      status: 'completed',
      actualResult,
      evaluation: {
        isCompliant: true,
        explanation: 'Test case adjusted to match actual result',
        score: 1.0,
      },
    };

    // Update status based on evaluation score
    if (adjustedTestCase.evaluation.score <= 0.5) {
      adjustedTestCase.status = 'failed';
    } else if (adjustedTestCase.evaluation.score <= 0.75) {
      adjustedTestCase.status = 'warning';
    }

    return NextResponse.json({ testCase: adjustedTestCase });
  } catch (error) {
    console.error('Error adjusting test case:', error);
    return NextResponse.json(
      { error: 'Failed to adjust test case' },
      { status: 500 }
    );
  }
} 