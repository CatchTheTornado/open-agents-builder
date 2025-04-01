import { z } from "zod";
import { ToolDescriptor } from "./registry";
import { createDiskVectorStore, createOpenAIEmbeddings, VectorStore, VectorStoreEntry } from "@oab/vector-store";
import { tool } from "ai";
import { Agent } from "@/data/client/models";
import { getErrorMessage } from "@/lib/utils";
import { nanoid } from "nanoid";
import path from "path";

export function createContextVectorSaveTool(
  databaseIdHash: string,
  sessionId: string,
  storageKey: string | null | undefined,
  agent: Agent,
  vectorStore: VectorStore | null = null
): ToolDescriptor {
  return {
    displayName: "Save document to short term memory context vector store",
    tool: tool({
      description: "Save a document and its metadata to the short term memory context vector store.",
      parameters: z.object({
        id: z.string().describe("Unique identifier for the document. When not provided will be generated").optional(),
        content: z.string().describe("Content of the document"),
        metadata: z.string().describe("Additional metadata for the document"),
        shardName: z.string().optional().describe("Name of the store to save in - if not provided will use 'default'"),
        sessionOnly: z.boolean().optional().default(false).describe("Whether to search only in the current session")        
      }),
      execute: async ({ id, content, metadata, shardName, sessionOnly }) => {
        try {
          if (!id) id = nanoid();
          console.log(id, content, metadata, shardName, sessionOnly);

          // Create vector store if not provided
          if (!vectorStore) {
            const generateEmbeddings = createOpenAIEmbeddings({
              apiKey: process.env.OPENAI_API_KEY
            });

            vectorStore = createDiskVectorStore({
              storeName: shardName || 'default',
              partitionKey: databaseIdHash,
              maxFileSizeMB: 10,
              baseDir: path.resolve(process.cwd(), 'data'),
              generateEmbeddings
            });
          }

          // Create the entry
          const entry: VectorStoreEntry = {
            id,
            content,
            metadata: JSON.parse(metadata),
            embedding: await vectorStore.getConfig().generateEmbeddings(content)
          };

          await vectorStore.set(id, entry);    
          return `Document saved with id: ${id}`;
        } catch (err) {
          return `Error saving document: ${getErrorMessage(err)}`;
        }
      },
    }),
  };
}
