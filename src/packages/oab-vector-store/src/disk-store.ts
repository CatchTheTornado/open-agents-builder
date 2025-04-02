import fs from 'fs';
import path from 'path';
import { VectorStore, VectorStoreConfig, VectorStoreEntry, GenerateEmbeddings, PaginationParams, PaginatedResult, VectorStoreMetadata } from './types';
import { generateEntryId, getCurrentTimestamp } from './utils';

export class DiskVectorStore implements VectorStore {
  private filePath: string;
  private lockPath: string;
  private storeName: string;
  private generateEmbeddings: GenerateEmbeddings;
  private maxFileSizeMB: number;
  private partitionKey: string;

  constructor(config: VectorStoreConfig) {
    this.storeName = config.storeName;
    this.partitionKey = config.partitionKey;
    this.generateEmbeddings = config.generateEmbeddings;
    this.maxFileSizeMB = config.maxFileSizeMB || 10;
    
    // Remove .json extension if present in storeName
    const baseStoreName = this.storeName.replace(/\.json$/, '');
    
    // Store files directly in the memory-store directory
    this.filePath = path.join(config.baseDir, `${baseStoreName}.json`);
    this.lockPath = path.join(config.baseDir, `${baseStoreName}.lock`);
    
    // Ensure the directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async acquireLock(): Promise<void> {
    while (true) {
      try {
        await fs.promises.writeFile(this.lockPath, '', { flag: 'wx' });
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await fs.promises.unlink(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async ensureFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ 
        entries: {},
        metadata: {
          itemCount: 0,
          createdAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp(),
          lastAccessed: getCurrentTimestamp()
        }
      }, null, 2));
    }
  }

  async set(id: string, entry: VectorStoreEntry): Promise<void> {
    await this.acquireLock();
    try {
      await this.ensureFile();

      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);

      const currentSize = Buffer.byteLength(content, 'utf-8') / (1024 * 1024);
      if (currentSize >= this.maxFileSizeMB) {
        throw new Error(`File size limit reached (${this.maxFileSizeMB}MB)`);
      }

      data.entries[id] = {
        ...entry,
        updatedAt: getCurrentTimestamp()
      };

      // Update metadata
      data.metadata = {
        ...data.metadata,
        itemCount: Object.keys(data.entries).length,
        updatedAt: getCurrentTimestamp()
      };

      await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2));
    } finally {
      await this.releaseLock();
    }
  }

  async get(id: string): Promise<VectorStoreEntry | null> {
    await this.acquireLock();
    try {
      await this.ensureFile();

      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);

      return data.entries[id] || null;
    } finally {
      await this.releaseLock();
    }
  }

  async delete(id: string): Promise<void> {
    await this.acquireLock();
    try {
      await this.ensureFile();

      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);

      delete data.entries[id];
      await fs.promises.writeFile(this.filePath, JSON.stringify(data, null, 2));
    } finally {
      await this.releaseLock();
    }
  }

  async clear(): Promise<void> {
    await this.acquireLock();
    try {
      if (fs.existsSync(this.filePath)) {
        await fs.promises.unlink(this.filePath);
      }
    } finally {
      await this.releaseLock();
    }
  }

  async entries(params?: PaginationParams): Promise<PaginatedResult<VectorStoreEntry>> {
    await this.acquireLock();
    try {
      await this.ensureFile();

      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      const entries = Object.values(data.entries) as VectorStoreEntry[];

      if (!params) {
        return {
          items: entries,
          total: entries.length,
          hasMore: false
        };
      }

      const { offset = 0, limit = 10 } = params;
      const items = entries.slice(offset, offset + limit);
      const hasMore = offset + limit < entries.length;

      return {
        items,
        total: entries.length,
        hasMore
      };
    } finally {
      await this.releaseLock();
    }
  }

  async search(query: string, topK: number = 5): Promise<VectorStoreEntry[]> {
    const queryEmbedding = await this.generateEmbeddings(query);
    const { items: entries } = await this.entries();

    const results = entries.map(entry => ({
      entry,
      distance: this.euclideanDistance(queryEmbedding, entry.embedding)
    }));

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, topK)
      .map(result => ({
        ...result.entry,
        similarity: result.distance
      }));
  }

  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  async upsert(entry: VectorStoreEntry): Promise<void> {
    const id = entry.id || generateEntryId();
    await this.set(id, entry);
  }

  getConfig(): VectorStoreConfig {
    return {
      storeName: this.storeName,
      partitionKey: this.partitionKey,
      baseDir: path.dirname(this.filePath),
      generateEmbeddings: this.generateEmbeddings,
      maxFileSizeMB: this.maxFileSizeMB
    };
  }

  async getMetadata(): Promise<VectorStoreMetadata> {
    await this.ensureFile();

    const content = await fs.promises.readFile(this.filePath, 'utf-8');
    const data = JSON.parse(content);
    const metadata = data.metadata || {
      itemCount: Object.keys(data.entries).length,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      lastAccessed: getCurrentTimestamp()
    };

    return {
      name: this.storeName,
      partitionKey: this.partitionKey,
      itemCount: metadata.itemCount,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      lastAccessed: metadata.lastAccessed
    };
  }
}

export function createDiskVectorStore(config: VectorStoreConfig): VectorStore {
  return new DiskVectorStore(config);
} 