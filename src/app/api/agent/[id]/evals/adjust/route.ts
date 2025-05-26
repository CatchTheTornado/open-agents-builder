import { NextRequest, NextResponse } from 'next/server';
import { OpenAgentsBuilderClient } from 'open-agents-builder-client';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authorizeRequestContext } from '@/lib/authorization-api';
import { precheckAPIRequest } from '@/lib/middleware-precheck-api';

const adjustTestCaseSchema = z.object({
  testCaseId: z.string(),
  actualResult: z.string(),
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
    
    Please provide:
    1. The adjusted test case messages
    2. The adjusted expected result
    3. A brief explanation of the changes made`;

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
    const adjustedTestCase = {
      id: testCaseId,
      messages: [
        {
          role: 'user',
          content: collectedContent,
        },
      ],
      expectedResult: actualResult,
      status: 'completed',
      actualResult,
      evaluation: {
        isCompliant: true,
        explanation: 'Test case adjusted to match actual result',
        score: 1.0,
      },
    };

    return NextResponse.json({ testCase: adjustedTestCase });
  } catch (error) {
    console.error('Error adjusting test case:', error);
    return NextResponse.json(
      { error: 'Failed to adjust test case' },
      { status: 500 }
    );
  }
} 