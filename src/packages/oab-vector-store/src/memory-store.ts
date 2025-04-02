import { VectorStore, VectorStoreConfig, VectorStoreEntry, GenerateEmbeddings, PaginationParams, PaginatedResult, VectorStoreMetadata } from './types';
import { generateEntryId, getCurrentTimestamp } from './utils';

export class InMemoryVectorStore implements VectorStore {
  private store: Map<string, VectorStoreEntry>;
  private config: VectorStoreConfig;
  private generateEmbeddings: GenerateEmbeddings;

  constructor(config: VectorStoreConfig) {
    this.store = new Map();
    this.config = config;
    this.generateEmbeddings = config.generateEmbeddings;
  }

  async set(id: string, entry: VectorStoreEntry): Promise<void> {
    this.store.set(id, {
      ...entry,
      updatedAt: getCurrentTimestamp()
    });
  }

  async get(id: string): Promise<VectorStoreEntry | null> {
    return this.store.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async upsert(entry: VectorStoreEntry): Promise<void> {
    const id = entry.id || generateEntryId();
    await this.set(id, entry);
  }

  async entries(params?: PaginationParams): Promise<PaginatedResult<VectorStoreEntry>> {
    const allEntries = Array.from(this.store.values());
    const total = allEntries.length;

    if (!params) {
      return {
        items: allEntries,
        total,
        hasMore: false
      };
    }

    const { limit, offset } = params;
    const items = allEntries.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items,
      total,
      hasMore
    };
  }

  async search(query: string, topK: number = 5): Promise<VectorStoreEntry[]> {
    const queryEmbedding = await this.generateEmbeddings(query);
    const { items } = await this.entries();
    
    return items
      .map(entry => ({
        ...entry,
        similarity: this.cosineSimilarity(queryEmbedding, entry.embedding)
      }))
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, topK);
  }

  getConfig(): VectorStoreConfig {
    return this.config;
  }

  async getMetadata(): Promise<VectorStoreMetadata> {
    return {
      name: this.config.storeName,
      partitionKey: this.config.partitionKey,
      itemCount: this.store.size,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      lastAccessed: getCurrentTimestamp()
    };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a ** 2, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b ** 2, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export function createInMemoryVectorStore(config: VectorStoreConfig): VectorStore {
  return new InMemoryVectorStore(config);
} 