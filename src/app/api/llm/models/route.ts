import { getDefaultModels } from '@/lib/llm-provider';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const provider = searchParams.get('provider');
    
    if (!provider) {
      return Response.json({ error: 'Provider parameter is required' }, { status: 400 });
    }
    
    const models = getDefaultModels(provider);
    return Response.json({ models });
  } catch (error) {
    console.error('Error fetching LLM models:', error);
    return Response.json({ error: 'Failed to fetch LLM models' }, { status: 500 });
  }
}