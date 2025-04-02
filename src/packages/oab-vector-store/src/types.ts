import { z } from 'zod';
import path from 'path';

/**
 * Core types for vector store entries
 */
export const vectorStoreEntrySchema = z.object({
  id: z.string(),
  content: z.string(),
  embedding: z.array(z.number()),
  metadata: z.record(z.unknown()),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type VectorStoreEntry = z.infer<typeof vectorStoreEntrySchema>;

/**
 * Vector store metadata
 */
export const vectorStoreMetadataSchema = z.object({
  name: z.string(),
  partitionKey: z.string(),
  itemCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastAccessed: z.string().optional(),
});

export type VectorStoreMetadata = z.infer<typeof vectorStoreMetadataSchema>;

/**
 * Vector store configuration
 */
export const vectorStoreConfigSchema = z.object({
  storeName: z.string(),
  partitionKey: z.string(),
  maxFileSizeMB: z.number().optional(),
  baseDir: z.string().default(() => path.resolve(process.cwd(), 'data')),
  generateEmbeddings: z.function()
    .args(z.string())
    .returns(z.promise(z.array(z.number())))
});

export type VectorStoreConfig = z.infer<typeof vectorStoreConfigSchema>;

/**
 * Core vector store interface that all implementations must follow
 */
export interface VectorStore {
  // Core CRUD operations
  set: (id: string, entry: VectorStoreEntry) => Promise<void>;
  get: (id: string) => Promise<VectorStoreEntry | null>;
  delete: (id: string) => Promise<void>;
  upsert: (entry: VectorStoreEntry) => Promise<void>;
  
  // Query operations
  entries: (params?: PaginationParams) => Promise<PaginatedResult<VectorStoreEntry>>;
  search: (query: string, topK?: number) => Promise<VectorStoreEntry[]>;
  
  // Store management
  getConfig: () => VectorStoreConfig;
  getMetadata: () => Promise<VectorStoreMetadata>;
  clear: () => Promise<void>;
}

/**
 * Vector store manager interface for managing multiple stores
 */
export interface VectorStoreManager {
  // Store management
  createStore: (config: VectorStoreConfig) => Promise<VectorStore>;
  deleteStore: (partitionKey: string, storeName: string) => Promise<void>;
  getStore: (partitionKey: string, storeName: string) => Promise<VectorStore | null>;
  listStores: (partitionKey: string, params?: PaginationParams) => Promise<PaginatedResult<VectorStoreMetadata>>;
  searchStores: (partitionKey: string, query: string, topK?: number) => Promise<VectorStoreMetadata[]>;
  // Metadata management
  updateStoreMetadata: (partitionKey: string, storeName: string, metadata: Partial<VectorStoreMetadata>) => Promise<void>;
}

/**
 * Factory function type for creating vector stores
 */
export type VectorStoreFactory = (config: VectorStoreConfig) => VectorStore;

/**
 * Factory function type for creating vector store managers
 */
export type VectorStoreManagerFactory = (config: { baseDir: string }) => VectorStoreManager;

/**
 * Embedding generation function type
 */
export type GenerateEmbeddings = (content: string) => Promise<number[]>;

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
} 