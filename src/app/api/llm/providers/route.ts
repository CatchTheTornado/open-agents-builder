import { getAvailableProviders } from '@/lib/llm-provider';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const providers = getAvailableProviders();
    return Response.json({ providers });
  } catch (error) {
    console.error('Error fetching LLM providers:', error);
    return Response.json({ error: 'Failed to fetch LLM providers' }, { status: 500 });
  }
}