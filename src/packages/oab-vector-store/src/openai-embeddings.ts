import { GenerateEmbeddings } from './types';

interface OpenAIEmbeddingsConfig {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Create an OpenAI embeddings provider
 */
export const createOpenAIEmbeddings = ({
  model = 'text-embedding-ada-002',
  baseUrl = 'https://api.openai.com/v1',
  apiKey = process.env.OPENAI_API_KEY,
}: OpenAIEmbeddingsConfig = {}): GenerateEmbeddings => {
  return async (content: string): Promise<number[]> => {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: content,
        model,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  };
}; 