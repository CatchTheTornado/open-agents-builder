import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { llmProviderSetup } from '@/lib/llm-provider';
import { authorizeRequestContext } from '@/lib/authorization-api';
import { renderPrompt, getLocale } from '@/lib/templates';

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
  _params: { params: { id: string } },
   response: NextResponse
) {
  try {
    const { prompt } = await request.json();
    await authorizeRequestContext(request, response);
    const locale = getLocale(request);

    // Get the prompt using renderPrompt
    const fullPrompt = await renderPrompt(locale, 'eval-generate', { prompt });

    const result = await generateObject({
      model: llmProviderSetup(),
      maxTokens: 2000,
      temperature: 0.2,
      topP: 0.95,
      schema: generateTestCasesSchema,
      prompt: fullPrompt
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