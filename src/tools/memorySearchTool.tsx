import { z } from "zod";
import { ToolDescriptor } from "./registry";
import { createVectorStore, createOpenAIEmbeddings, VectorStore } from "oab-vector-store";
import { tool } from "ai";
import { Agent } from "@/data/client/models";
import { getErrorMessage } from "@/lib/utils";
import path from "path";

export function createMemorySearchTool(
  databaseIdHash: string,
  sessionId: string,
  storageKey: string | null | undefined,
  agent: Agent
): ToolDescriptor {
  return {
    displayName: "Search in memory store",
    tool: tool({
      description: "Search for documents in the memory store based on a query.",
      parameters: z.object({
        query: z.string().describe("Search query"),
        storeName: z.string().optional().describe("Name of the store to search in - if not provided will use 'default'"),
        limit: z.number().optional().default(5).describe("Maximum number of results to return")
      }),
      execute: async ({ query, storeName, limit }) => {
        try {
          // Create vector store if not provided
          const generateEmbeddings = createOpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY
          });

          const vectorStore = createVectorStore({
            storeName: storeName || 'default',
            partitionKey: databaseIdHash,
            maxFileSizeMB: 10,
            baseDir: path.resolve(process.cwd(), 'data', databaseIdHash, 'memory-store'),
            generateEmbeddings
          });

          const results = await vectorStore.search(query, limit);
          return JSON.stringify(results);
        } catch (err) {
          return `Error searching documents: ${getErrorMessage(err)}`;
        }
      },
    }),
  };
}
