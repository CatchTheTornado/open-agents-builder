import { z } from "zod";
import { ToolDescriptor } from "./registry";
import { createVectorStore, createOpenAIEmbeddings, VectorStore, VectorStoreEntry, createVectorStoreManager } from "oab-vector-store";
import { tool } from "ai";
import { Agent } from "@/data/client/models";
import { getErrorMessage, safeJsonParse } from "@/lib/utils";
import { nanoid } from "nanoid";
import path from "path";
import { getDataDir } from "@/utils/paths";

export function createMemorySaveTool(
  databaseIdHash: string,
  sessionId: string,
  storageKey: string | null | undefined,
  agent: Agent
): ToolDescriptor {
  return {
    displayName: "Save document to memory store",
    tool: tool({
      description: "Save a document and its metadata to the memory store.",
      parameters: z.object({
        id: z.string().describe("Unique identifier for the document. When not provided will be generated").optional(),
        content: z.string().describe("Content of the document"),
        metadata: z.string().describe("Additional metadata for the document"),
        storeName: z.string().optional().describe("Name of the store to save in - if not provided will use 'default'"),
        shortTerm: z.boolean().optional().default(false).describe("Whether to save the document as short term memory"),
        expirationPeriod: z.number().optional().default(0).describe("Expiration period in hours for short term memory")
      }),
      execute: async ({ id, content, metadata, storeName, expirationPeriod, shortTerm }) => {
        try {
          if (!id) id = nanoid();
          // Create vector store if not provided
          const baseDir = getDataDir(databaseIdHash);
          const generateEmbeddings = createOpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY
          });

          const vectorStore = await createVectorStore({
            storeName: storeName || 'default',
            partitionKey: databaseIdHash,
            maxFileSizeMB: 10,
            baseDir,
            generateEmbeddings
          });


          // Create the entry
          const entry: VectorStoreEntry = {
            id,
            content,
            metadata: safeJsonParse(metadata, {}),
            embedding: await vectorStore.getConfig().generateEmbeddings(content)
          };

          if (shortTerm) { // this is a short term memory
            entry.sessionId = sessionId;
            entry.expiry = new Date(Date.now() + expirationPeriod * 60 * 60 * 1000).toISOString();
          }

          await vectorStore.set(id, entry);

          const storeManager = createVectorStoreManager({
            baseDir
          });

          // Get the updated total count
          const { total } = await vectorStore.entries();

          // Update the store metadata
          const storeMetadata = await vectorStore.getMetadata();
          await storeManager.updateStoreMetadata(databaseIdHash, storeName || 'default', {
            ...storeMetadata,
            itemCount: total,
            updatedAt: new Date().toISOString()
          });

          return `Document saved with id: ${id}`;
        } catch (err) {
          console.error(err);
          return `Error saving document: ${getErrorMessage(err)}`;
        }
      },
    }),
  };
}
