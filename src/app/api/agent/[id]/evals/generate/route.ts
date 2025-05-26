import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { llmProviderSetup } from '@/lib/llm-provider';
import { authorizeRequestContext } from '@/lib/authorization-api';

const testCaseSchema = z.object({
  id: z.string(),
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

const generateTestCasesSchema = z.object({
  testCases: z.array(testCaseSchema)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
   response: NextResponse
) {
  try {
    const { prompt } = await request.json();
    const requestContext = await authorizeRequestContext(request, response);

    const result = await generateObject({
      model: llmProviderSetup(),
      maxTokens: 2000,
      temperature: 0.2,
      topP: 0.95,
      schema: generateTestCasesSchema,
      prompt: `Based on the following agent prompt, generate a list of test cases in JSON format. Each test case should have a conversation (messages array) and expected result. The conversation can have multiple messages. Format:
      {
        "testCases": [
          {
            "id": "unique-id",
            "messages": [
              {
                "role": "user",
                "content": "user message"
              },
              {
                "role": "assistant",
                "content": "assistant message",
                "toolCalls": [{"name": "tool_name", "arguments": {}}] // optional
              }
            ],
            "expectedResult": "expected final result"
          }
        ]
      }

      Agent prompt:
      ${prompt}`,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error('Failed to generate test cases:', error);
    return NextResponse.json(
      { error: 'Failed to generate test cases' },
      { status: 500 }
    );
  }
} 