// File: src/data/client/memory-api-client.ts

import { AdminApiClient, ApiEncryptionConfig } from "./admin-api-client";
import { DatabaseContextType } from "@/contexts/db-context";
import { SaaSContextType } from "@/contexts/saas-context";

export interface StoreMetadata {
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface StoreIndex {
  [databaseIdHash: string]: {
    [storeName: string]: StoreMetadata;
  };
}

export interface MemoryListResponse {
  files: {
    file: string;
    displayName: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
    lastAccessed?: string;
  }[];
  limit: number;
  offset: number;
  hasMore: boolean;
  total: number;
}

export interface MemoryQueryParams {
  limit?: number;
  offset?: number;
  query?: string;
}

export interface MemoryRecordRow {
  id: string;
  metadata: Record<string, unknown>;
  content: string;
  embeddingPreview?: number[];
  similarity?: number; // Only present if vector search is used
}

export interface MemoryRecordsResponse {
  total: number;
  rows: MemoryRecordRow[];
  vectorSearchQuery?: string;
}

export class MemoryApiClient extends AdminApiClient {
  storageSchema: string;

  constructor(
    baseUrl: string,
    storageSchema: string,
    dbContext?: DatabaseContextType | null,
    saasContext?: SaaSContextType | null,
    encryptionConfig?: ApiEncryptionConfig
  ) {
    super(baseUrl, dbContext, saasContext, encryptionConfig);
    this.storageSchema = storageSchema;
  }

  private ensureStoreNameFormat(storeName: string): string {
    // Remove .json extension if present
    const nameWithoutExtension = storeName.replace(/\.json$/, '');
    
    // Check if the name contains only letters, digits, and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(nameWithoutExtension)) {
      throw new Error("Store name can only contain letters, numbers, and underscores");
    }
    
    return nameWithoutExtension;
  }

  /**
   * Create a new vector store with the given name
   */
  async createStore(storeName: string): Promise<void> {
    const fileName = this.ensureStoreNameFormat(storeName);
    
    const response = await this.request<{ error?: string }>(
      `/api/memory/create`,
      "POST",
      { encryptedFields: [] },
      { storeName: fileName },
      undefined,
      undefined,
      { "Storage-Schema": this.storageSchema }
    );

    // Check if the response contains an error message
    if (response && 'error' in response) {
      throw new Error(response.error);
    }
  }

  /**
   * Lists memory files with possible pagination & search by filename.
   */
  async query(params: MemoryQueryParams): Promise<MemoryListResponse> {
    const { limit, offset, query } = params;
    const searchParams = new URLSearchParams({
      limit: String(limit || 10),
      offset: String(offset || 0),
    });
    if (query) {
      searchParams.append("query", query);
    }
    const url = `/api/memory/query?` + searchParams.toString();

    const response = await this.request<MemoryListResponse>(
      url,
      "GET",
      { encryptedFields: [] },
      undefined,
      undefined,
      undefined,
      { "Storage-Schema": this.storageSchema }
    );
    return response as MemoryListResponse;
  }

  /**
   * Returns the raw file content (full JSON)
   */
  async getFileContent(filename: string): Promise<string> {
    const fileName = this.ensureStoreNameFormat(filename);
    
    const response = await this.request<string>(
      `/api/memory/${fileName}`,
      "GET",
      { encryptedFields: [] },
      undefined,
      undefined,
      undefined,
      { "Storage-Schema": this.storageSchema }
    );
    return response as string;
  }

  /**
   * Lists or vector-searches records in a single memory file.
   * - limit, offset for normal pagination
   * - embeddingSearch for vector search
   * - topK for how many vector matches to return
   */
  async listRecords(
    filename: string,
    opts: { limit: number; offset: number; embeddingSearch?: string; topK?: number }
  ): Promise<MemoryRecordsResponse> {
    const fileName = this.ensureStoreNameFormat(filename);
    const { limit, offset, embeddingSearch, topK } = opts;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (embeddingSearch) {
      params.append("embeddingSearch", embeddingSearch);
      if (topK) {
        params.append("topK", String(topK));
      }
    }

    const url = `/api/memory/${fileName}/records?` + params.toString();
    const response = await this.request<MemoryRecordsResponse>(
      url,
      "GET",
      { encryptedFields: [] },
      undefined,
      undefined,
      undefined,
      { "Storage-Schema": this.storageSchema }
    );
    return response as MemoryRecordsResponse;
  }

  /**
   * Delete the specified memory file from the server.
   */
  async deleteFile(filename: string): Promise<{ message: string; status: number }> {
    const fileName = this.ensureStoreNameFormat(filename);
    
    const response = await this.request<{ message: string; status: number }>(
      `/api/memory/${fileName}`,
      "DELETE",
      { encryptedFields: [] },
      undefined,
      undefined,
      undefined,
      { "Storage-Schema": this.storageSchema }
    );
    return response as { message: string; status: number };
  }

  /**
   * Save a record to a vector store
   */
  async saveRecord(
    fileName: string,
    record: {
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      embedding: number[];
    }
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Storage-Schema": this.storageSchema
    };

    await this.request<void>(
      `/api/memory/${fileName}/records`,
      "POST",
      { encryptedFields: [] },
      record,
      undefined,
      undefined,
      headers
    );
  }

  /**
   * Generate embeddings for content using OpenAI
   */
  async generateEmbeddings(content: string): Promise<number[]> {
    const response = await this.request<{ embedding: number[] }>(
      `/api/memory/embeddings`,
      "POST",
      { encryptedFields: [] },
      { content },
      undefined,
      undefined,
      { "Storage-Schema": this.storageSchema }
    ) as { embedding: number[] };
    return response.embedding;
  }

  /**
   * Delete a record from a vector store
   */
  async deleteRecord(fileName: string, recordId: string): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Storage-Schema": this.storageSchema
    };

    await this.request<void>(
      `/api/memory/${fileName}/records/${recordId}`,
      "DELETE",
      { encryptedFields: [] },
      undefined,
      undefined,
      undefined,
      headers
    );
  }
}
