import { authorizeRequestContext } from "@/lib/authorization-api";
import { getErrorMessage } from "@/lib/utils";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    console.log('Fetching OpenAI models...');
    
    // Authorize the request (following the exact pattern from other API routes)
    const requestContext = await authorizeRequestContext(req, res);
    console.log("OpenAI models API - Authorization successful:", requestContext?.databaseIdHash ? 'OK' : 'No database');
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, returning default models');
      return Response.json({ 
        models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]
      });
    }
    
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Filter to only include GPT models and sort
      const models = data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();
      
      console.log('OpenAI models fetched:', models.length);
      return Response.json({ models });
    } else {
      console.error('OpenAI API error:', response.status);
      // Return default models on API error
      return Response.json({ 
        models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]
      });
    }
  } catch (error) {
    console.error('Error fetching OpenAI models:', error);
    // Return error following the same pattern as other API routes
    return Response.json({ 
      message: getErrorMessage(error), 
      status: 499 
    }, { status: 499 });
  }
}
