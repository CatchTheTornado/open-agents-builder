// File: src/app/api/memory/[filename]/records/route.tsx

import { NextRequest, NextResponse } from "next/server";
import { authorizeRequestContext } from "@/lib/authorization-api";
import { authorizeSaasContext, authorizeStorageSchema } from "@/lib/generic-api";
import { createVectorStoreManager, createOpenAIEmbeddings, createVectorStore } from "oab-vector-store";
import { getDataDir } from "@/utils/paths";
import path from 'path';
import { VectorStoreEntry, VectorStore } from "oab-vector-store";

async function getOrCreateStore(databaseIdHash: string, storeName: string): Promise<VectorStore> {
  const storeManager = createVectorStoreManager({
    baseDir: getDataDir(databaseIdHash)
  });

  const generateEmbeddings = createOpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY
  });

  const existingStore = await storeManager.getStore(databaseIdHash, storeName);
  
  if (!existingStore) {
    return await storeManager.createStore({
      storeName,
      partitionKey: databaseIdHash,
      baseDir: getDataDir(databaseIdHash),
      generateEmbeddings
    });
  } else {
    // Recreate the store with embeddings function
    return createVectorStore({
      storeName,
      partitionKey: databaseIdHash,
      baseDir: getDataDir(databaseIdHash),
      generateEmbeddings
    });
  }
}

/**
 * GET /api/memory/[filename]/records
 * Query or vector-search records in a single memory JSON file.
 * Query params:
 *   - limit=10
 *   - offset=0
 *   - embeddingSearch=some text => triggers server-side vector search
 *   - topK=5 (optional, if embeddingSearch is used)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const requestContext = await authorizeRequestContext(request);
    await authorizeSaasContext(request);
    await authorizeStorageSchema(request);

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const embeddingSearch = searchParams.get('embeddingSearch');
    let topK = parseInt(searchParams.get('topK') || '5');
    if (isNaN(topK)) {
      topK = 5; // Default value if topK is not a valid number
    }
    const store = await getOrCreateStore(requestContext.databaseIdHash, params.filename);

    if (embeddingSearch) {
      const results = await store.search(embeddingSearch, topK);
      return NextResponse.json({
        rows: results.map(entry => {
          interface SearchResult extends VectorStoreEntry {
            embeddingPreview: number[];
            similarity?: number;
          }
          const result: SearchResult = {
            ...entry,
            embeddingPreview: entry.embedding.slice(0, 8)
          };
          if ('similarity' in entry) {
            result.similarity = (entry as { similarity: number }).similarity;
          }
          return result;
        }),
        total: results.length,
        vectorSearchQuery: embeddingSearch
      });
    }

    const { items, total } = await store.entries({ limit, offset });

    return NextResponse.json({
      rows: items.map((entry: VectorStoreEntry) => ({
        id: entry.id,
        metadata: entry.metadata,
        content: entry.content,
        embeddingPreview: entry.embedding.slice(0, 8)
      })),
      total
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory/[filename]/records
 * Save a new record to the vector store.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const requestContext = await authorizeRequestContext(request);
    await authorizeSaasContext(request);
    await authorizeStorageSchema(request);

    const dataDir = getDataDir(requestContext.databaseIdHash);
    const storeManager = createVectorStoreManager({
      baseDir: dataDir
    });

    const record = await request.json();
    const { id, content, metadata: recordMetadata, embedding } = record;

    if (!id || !content || !embedding) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const store = await getOrCreateStore(requestContext.databaseIdHash, params.filename);

    const entry: VectorStoreEntry = {
      id,
      content,
      metadata: recordMetadata || {},
      embedding
    };

    await store.set(id, entry);

    // Get the updated total count
    const { total } = await store.entries();
    
    // Update the store metadata
    const storeMetadata = await store.getMetadata();
    await storeManager.updateStoreMetadata(requestContext.databaseIdHash, params.filename, {
      ...storeMetadata,
      itemCount: total,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving record:', error);
    return NextResponse.json(
      { error: 'Failed to save record' },
      { status: 500 }
    );
  }
}
