import { getDefaultModels } from '@/lib/llm-provider';
import { authorizeRequestContext } from "@/lib/authorization-api";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    // Authorize the request
    await authorizeRequestContext(req, res);
    
    const searchParams = req.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    
    if (!provider) {
      return Response.json({ error: 'Provider parameter is required' }, { status: 400 });
    }
    
    const models = getDefaultModels(provider);
    return Response.json({ models });
  } catch (error) {
    console.error('Error fetching LLM models:', error);
    return Response.json(
      { error: 'Failed to fetch LLM models', message: getErrorMessage(error) },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}