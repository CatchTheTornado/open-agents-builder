import fs from 'fs';
import path from 'path';
import { VectorStoreManager, VectorStoreConfig, VectorStoreMetadata, PaginationParams, PaginatedResult, VectorStore } from './types';
import { createDiskVectorStore } from './disk-store';
import { getCurrentTimestamp } from './utils';

interface StoreIndex {
  [storeName: string]: {
    name: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
    lastAccessed?: string;
  };
}

export class DiskVectorStoreManager implements VectorStoreManager {
  private baseDir: string;
  private indexPath: string;
  private lockPath: string;

  constructor(config: { baseDir: string }) {
    this.baseDir = config.baseDir;
    this.indexPath = path.join(this.baseDir, 'index.json');
    this.lockPath = path.join(this.baseDir, 'index.lock');
    
    // Ensure the base directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
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

  private async ensureIndexFile(): Promise<void> {
    if (!fs.existsSync(this.indexPath)) {
      const initialIndex: StoreIndex = {};
      await fs.promises.writeFile(this.indexPath, JSON.stringify(initialIndex, null, 2));
    }
  }

  private async readIndex(): Promise<StoreIndex> {
    try {
      await this.ensureIndexFile();
      const content = await fs.promises.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async writeIndex(index: StoreIndex): Promise<void> {
    await fs.promises.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  async createStore(config: VectorStoreConfig): Promise<VectorStore> {
    try {
      await this.acquireLock();
      const index = await this.readIndex();
      const storeName = config.storeName;

      if (index[storeName]) {
        throw new Error(`Store ${storeName} already exists`);
      }

      const store = createDiskVectorStore({
        ...config,
        baseDir: this.baseDir
      });

      const metadata = {
        name: storeName,
        itemCount: 0,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        lastAccessed: getCurrentTimestamp()
      };

      index[storeName] = metadata;
      await this.writeIndex(index);

      return store;
    } finally {
      await this.releaseLock();
    }
  }

  async getStore(partitionKey: string, storeName: string): Promise<VectorStore | null> {
    try {
      await this.acquireLock();
      const index = await this.readIndex();
      const metadata = index[storeName];

      if (!metadata) {
        return null;
      }

      // Update last accessed timestamp
      metadata.lastAccessed = getCurrentTimestamp();
      await this.writeIndex(index);

      return createDiskVectorStore({
        storeName,
        partitionKey,
        baseDir: this.baseDir,
        generateEmbeddings: async () => [], // This will be set when actually using the store
      });
    } finally {
      await this.releaseLock();
    }
  }

  async deleteStore(partitionKey: string, storeName: string): Promise<void> {
    try {
      await this.acquireLock();
      const index = await this.readIndex();
      
      if (index[storeName]) {
        delete index[storeName];
        await this.writeIndex(index);
      }

      const filePath = path.join(this.baseDir, `${storeName}.json`);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } finally {
      await this.releaseLock();
    }
  }

  async listStores(partitionKey: string, params?: PaginationParams): Promise<PaginatedResult<VectorStoreMetadata>> {
    try {
      await this.acquireLock();
      const index = await this.readIndex();
      const stores = Object.entries(index).map(([storeName, metadata]) => ({
        ...metadata,
        name: storeName,
        partitionKey
      }));

      const offset = params?.offset || 0;
      const limit = params?.limit || 10;

      return {
        items: stores.slice(offset, offset + limit),
        total: stores.length,
        hasMore: offset + limit < stores.length
      };
    } finally {
      await this.releaseLock();
    }
  }

  async searchStores(partitionKey: string, query: string, topK: number = 5): Promise<VectorStoreMetadata[]> {
    try {
      await this.acquireLock();
      const index = await this.readIndex();
      const stores = Object.entries(index).map(([storeName, metadata]) => ({
        ...metadata,
        name: storeName,
        partitionKey
      }));

      const queryLower = query.toLowerCase();
      return stores
        .filter(store => store.name.toLowerCase().includes(queryLower))
        .slice(0, topK);
    } finally {
      await this.releaseLock();
    }
  }

  async updateStoreMetadata(partitionKey: string, storeName: string, metadata: Partial<VectorStoreMetadata>): Promise<void> {
    try {
      await this.acquireLock();
      const index = await this.readIndex();
      if (!index[storeName]) {
        throw new Error(`Store ${storeName} not found`);
      }

      index[storeName] = {
        ...index[storeName],
        ...metadata,
        updatedAt: new Date().toISOString()
      };

      await this.writeIndex(index);
    } finally {
      await this.releaseLock();
    }
  }
}

export function createDiskVectorStoreManager(config: { baseDir: string }): VectorStoreManager {
  return new DiskVectorStoreManager(config);
} 