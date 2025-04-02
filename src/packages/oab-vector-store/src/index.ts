import { VectorStore, VectorStoreConfig, VectorStoreEntry, GenerateEmbeddings, VectorStoreManager } from './types';
import { createDiskVectorStore } from './disk-store';
import { createSQLiteVectorStore } from './sqlite-store';
import { createDiskVectorStoreManager } from './disk-store-manager';
import { createSQLiteVectorStoreManager } from './sqlite-store-manager';

export * from './types';
export * from './utils';
export * from './memory-store';
export * from './disk-store';
export * from './disk-store-manager';
export * from './openai-embeddings';
export * from './sqlite-store';

// Re-export commonly used types
export type { VectorStore, VectorStoreConfig, VectorStoreEntry, GenerateEmbeddings, VectorStoreManager } from './types';

// Factory function to create a vector store manager based on environment variable
export function createVectorStoreManager(config: { baseDir: string }): VectorStoreManager {
  const storageEngine = process.env.VECTOR_STORE_ENGINE || 'sqlite';
  
  switch (storageEngine.toLowerCase()) {
    case 'disk':
      return createDiskVectorStoreManager(config);
    case 'sqlite':
    default:
      return createSQLiteVectorStoreManager(config);
  }
}

// Factory function to create a vector store based on environment variable
export function createVectorStore(config: VectorStoreConfig): VectorStore {
  const storageEngine = process.env.VECTOR_STORE_ENGINE || 'sqlite';
  
  switch (storageEngine.toLowerCase()) {
    case 'disk':
      return createDiskVectorStore(config);
    case 'sqlite':
    default:
      return createSQLiteVectorStore(config);
  }
} 