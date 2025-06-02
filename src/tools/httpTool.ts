import { formatAxiosError, getErrorMessage } from '@/lib/utils';
import { tool } from 'ai';
import axios from 'axios'
import { z } from 'zod'

async function makeHttpRequest({
  url,
  method,
  headers,
  body,
}: {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
}): Promise<any> {
  try {
    const response = await axios({
      url,
      method,
      headers,
      data: body,
    })

    if (typeof response.data === 'object') {
      return JSON.stringify(response.data)
    } else return response.data as string
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        formatAxiosError(error)
      )
    } else {
      throw new Error(`Unknown error: ${getErrorMessage(error)}`)
    }
  }
}

export const httpTool = {
  displayName: 'Makes HTTP requests',
  tool: tool({
    description: 'Makes HTTP requests to specified URLs with configurable method, headers, and body.',
    parameters: z.object({
      url: z.string().describe('The URL to make the request to.'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('The HTTP method to use.'),
      headers: z.record(z.string()).optional().describe('Headers to include in the HTTP request.'),
      body: z
        .string()
        .describe(
          'The body of the HTTP request. For GET requests, this should typically be empty string. For other requests it could be JSON or other formats.'
        ),
    }),
    execute: async ({ url, method, headers, body }) => {
      return makeHttpRequest({ url, method, headers, body })
    },
  })
};

