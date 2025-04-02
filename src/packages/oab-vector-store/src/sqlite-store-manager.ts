import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { VectorStoreManager, VectorStoreConfig, VectorStoreMetadata, PaginationParams, PaginatedResult, VectorStore } from './types';
import { createSQLiteVectorStore } from './sqlite-store';
import { getCurrentTimestamp } from './utils';
import { SqliteMigrationManager, MigrationType } from './sqlite-migrations/migration-manager';

interface StoreIndexRow {
  storeName: string;
  partitionKey: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lastAccessed: string | null;
}

export class SQLiteVectorStoreManager implements VectorStoreManager {
  private baseDir: string;
  private indexDbPath: string;
  private db: DatabaseType;
  private migrationManager: SqliteMigrationManager;

  constructor(config: { baseDir: string }) {
    this.baseDir = config.baseDir;
    this.indexDbPath = path.join(this.baseDir, 'stores_index.sqlite');
    
    // Ensure base directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    // Initialize the stores index database
    this.db = new Database(this.indexDbPath);
    this.migrationManager = new SqliteMigrationManager(this.db, 'stores_index', this.indexDbPath, 'manager' as MigrationType);
    this.initializeStoresIndex();
  }

  private initializeStoresIndex() {
    try {
      // Run migrations synchronously
      this.migrationManager.migrate();
    } catch (error) {
      throw new Error(`Failed to initialize stores index: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeQuery(query: string, params: unknown[] = []) {
    try {
      return this.db.prepare(query).run(...params);
    } catch (error) {
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeQueryWithResult<T>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      return this.db.prepare(query).all(...params) as T[];
    } catch (error) {
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async getStore(partitionKey: string, storeName: string) {
    this.ensureDirectoryExists(this.baseDir);
    
    // Check if store exists in the index
    const existing = this.db.prepare('SELECT storeName FROM stores_index WHERE storeName = ? AND partitionKey = ?')
      .get(storeName, partitionKey);

    if (!existing) {
      return null;
    }

    return createSQLiteVectorStore({
      storeName,
      partitionKey,
      baseDir: this.baseDir,
      generateEmbeddings: async (text: string, ...args: unknown[]) => [], // This will be set when actually using the store
    });
  }

  async createStore(config: { storeName: string; partitionKey: string; baseDir: string; generateEmbeddings: (text: string, ...args: unknown[]) => Promise<number[]>; maxFileSizeMB?: number }) {
    this.ensureDirectoryExists(this.baseDir);
    
    // Check if store already exists in the index
    const existing = this.db.prepare('SELECT storeName FROM stores_index WHERE storeName = ? AND partitionKey = ?')
      .get(config.storeName, config.partitionKey);
    
    if (existing) {
      // Double check if the store file actually exists
      const dbPath = path.join(this.baseDir, `${config.storeName}.sqlite`);
      if (!fs.existsSync(dbPath)) {
        // Store is in index but file doesn't exist - clean up the index entry
        this.db.prepare('DELETE FROM stores_index WHERE storeName = ? AND partitionKey = ?')
          .run(config.storeName, config.partitionKey);
      } else {
        throw new Error(`Store ${config.storeName} already exists`);
      }
    }

    try {
      // Create the store first
      const store = createSQLiteVectorStore({
        storeName: config.storeName,
        partitionKey: config.partitionKey,
        baseDir: this.baseDir,
        generateEmbeddings: config.generateEmbeddings,
      });

      // Test if the store is properly initialized by checking if we can access it
      const storeDb = new Database(path.join(this.baseDir, `${config.storeName}.sqlite`));
      storeDb.close();

      // If store creation was successful, add to the index
      const now = getCurrentTimestamp();
      this.db.prepare(`
        INSERT INTO stores_index (storeName, partitionKey, itemCount, createdAt, updatedAt, lastAccessed)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(config.storeName, config.partitionKey, 0, now, now, now);

      return store;
    } catch (err) {
      // If store creation failed, clean up any partial files
      try {
        const dbPath = path.join(this.baseDir, `${config.storeName}.sqlite`);
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
        }
      } catch (cleanupErr) {
        console.error('Failed to cleanup after failed store creation:', cleanupErr);
      }
      throw new Error(`Failed to create store: ${err}`);
    }
  }

  async deleteStore(partitionKey: string, storeName: string) {
    const dbPath = path.join(this.baseDir, `${storeName}.sqlite`);
    
    // Delete from stores index
    this.db.prepare('DELETE FROM stores_index WHERE storeName = ? AND partitionKey = ?')
      .run(storeName, partitionKey);
    
    // Close any open connections
    const db = new Database(dbPath);
    db.close();
    
    // Delete the database file
    try {
      fs.unlinkSync(dbPath);
    } catch (err) {
      // Ignore errors if file doesn't exist
    }
  }

  async listStores(partitionKey: string, params?: PaginationParams): Promise<PaginatedResult<VectorStoreMetadata>> {
    const offset = params?.offset || 0;
    const limit = params?.limit || 10;

    // Get total count
    const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM stores_index WHERE partitionKey = ?')
      .get(partitionKey) as { count: number };

    // Get paginated results
    const rows = this.db.prepare(`
      SELECT * FROM stores_index 
      WHERE partitionKey = ? 
      ORDER BY lastAccessed DESC 
      LIMIT ? OFFSET ?
    `).all(partitionKey, limit, offset) as StoreIndexRow[];

    return {
      items: rows.map(row => ({
        name: row.storeName,
        partitionKey: row.partitionKey,
        itemCount: row.itemCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastAccessed: row.lastAccessed
      })),
      total: totalCount.count,
      hasMore: offset + limit < totalCount.count
    };
  }

  async searchStores(partitionKey: string, query: string, topK: number = 5): Promise<VectorStoreMetadata[]> {
    const rows = this.db.prepare(`
      SELECT * FROM stores_index 
      WHERE partitionKey = ? 
      AND storeName LIKE ? 
      ORDER BY lastAccessed DESC 
      LIMIT ?
    `).all(partitionKey, `%${query.toLowerCase()}%`, topK) as StoreIndexRow[];

    return rows.map(row => ({
      name: row.storeName,
      partitionKey: row.partitionKey,
      itemCount: row.itemCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastAccessed: row.lastAccessed
    }));
  }

  async updateStoreMetadata(partitionKey: string, storeName: string, metadata: Partial<VectorStoreMetadata>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (metadata.itemCount !== undefined) {
      updates.push('itemCount = ?');
      values.push(metadata.itemCount);
    }
    if (metadata.updatedAt !== undefined) {
      updates.push('updatedAt = ?');
      values.push(metadata.updatedAt);
    }
    if (metadata.lastAccessed !== undefined) {
      updates.push('lastAccessed = ?');
      values.push(metadata.lastAccessed);
    }

    if (updates.length === 0) return;

    values.push(storeName);
    values.push(partitionKey);

    this.db.prepare(`
      UPDATE stores_index 
      SET ${updates.join(', ')} 
      WHERE storeName = ? AND partitionKey = ?
    `).run(values);
  }
}

export function createSQLiteVectorStoreManager(config: { baseDir: string }): VectorStoreManager {
  return new SQLiteVectorStoreManager(config);
} 