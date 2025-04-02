import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { VectorStore, VectorStoreConfig, VectorStoreEntry, GenerateEmbeddings, PaginationParams, PaginatedResult, VectorStoreMetadata } from './types';
import { generateEntryId, getCurrentTimestamp } from './utils';

interface DatabaseRow {
  id: string;
  content: string;
  embedding: Buffer;
  metadata: Buffer;
  createdAt: string;
  updatedAt: string;
}

interface MetadataRow {
  key: string;
  value: string;
}

interface CountRow {
  count: number;
}

export class SQLiteVectorStore implements VectorStore {
  private db: DatabaseType;
  private storeName: string;
  private generateEmbeddings: GenerateEmbeddings;
  private partitionKey: string;
  private dbPath: string;

  constructor(config: VectorStoreConfig) {
    this.storeName = config.storeName;
    this.partitionKey = config.partitionKey;
    this.generateEmbeddings = config.generateEmbeddings;
    
    // Store files directly in the base directory
    this.dbPath = path.join(config.baseDir, `${config.storeName}.sqlite`);
    
    // Ensure directory exists
    const dirPath = path.dirname(this.dbPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Check if we can access the directory
    try {
      fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err) {
      throw new Error(`Cannot access directory ${dirPath}: ${err}`);
    }
    // Initialize SQLite database with verbose error handling
    try {
      this.db = new Database(this.dbPath);
    } catch (err) {
      throw new Error(`Failed to open database at ${this.dbPath}: ${err}`);
    }

    try {
      sqliteVec.load(this.db);
    } catch (err) {
      throw new Error(`Failed to load SQLite vector extension: ${err}`);
    }

    try {
      this.initializeDatabase();
    } catch (err) {
      throw new Error(`Failed to initialize database: ${err}`);
    }
  }

  private initializeDatabase(): void {
    try {
      // Create tables if they don't exist
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          vector_id INTEGER
        )
      `).run();

      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `).run();

      // Initialize metadata if not exists
      const now = getCurrentTimestamp();
      const metadataRows = [
        { key: 'itemCount', value: '0' },
        { key: 'createdAt', value: now },
        { key: 'updatedAt', value: now },
        { key: 'lastAccessed', value: now }
      ];

      for (const row of metadataRows) {
        this.db.prepare('INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)').run(row.key, row.value);
      }

      // Create index on vector_id
      this.db.prepare('CREATE INDEX IF NOT EXISTS idx_vector_id ON entries(vector_id)').run();

      // Create vector index virtual table last
      this.db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vector_index USING vec0(
          id integer primary key autoincrement,
          embedding float[1536]
        )
      `).run();
    } catch (err) {
      throw new Error(`Failed to initialize database tables: ${err}`);
    }
  }

  async set(id: string, entry: VectorStoreEntry): Promise<void> {
    const now = getCurrentTimestamp();
    const metadataBlob = Buffer.from(JSON.stringify(entry.metadata));

    try {
      // Begin transaction
      const transaction = this.db.transaction(() => {
        // Get next vector_id
        const maxVectorId = this.db.prepare('SELECT COALESCE(MAX(vector_id), 0) as max_id FROM entries').get() as { max_id: number };
        const vectorId = maxVectorId.max_id + 1;

        // Insert into entries table
        this.db.prepare(
          `INSERT OR REPLACE INTO entries (id, content, metadata, createdAt, updatedAt, vector_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, entry.content, metadataBlob, now, now, vectorId);

        // Convert embedding to Float32Array and then to Uint8Array
        const embeddingArray = new Float32Array(entry.embedding);
        const embeddingBuffer = new Uint8Array(embeddingArray.buffer);

        // Insert into vector index using the integer vector_id
        this.db.prepare(
          `INSERT INTO vector_index(embedding) VALUES (?)`
        ).run(embeddingBuffer);

        // Update metadata
        this.db.prepare(
          'UPDATE metadata SET value = (SELECT COUNT(*) FROM entries) WHERE key = ?'
        ).run('itemCount');
        
        this.db.prepare(
          'UPDATE metadata SET value = ? WHERE key = ?'
        ).run(now, 'updatedAt');
      });

      // Execute the transaction
      transaction();

      // Verify the record was saved
      const saved = this.db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
      if (!saved) {
        throw new Error('Failed to save record: Record not found after save');
      }
    } catch (err) {
      console.error('Error saving record:', err);
      throw new Error(`Failed to save record: ${err}`);
    }
  }

  async get(id: string): Promise<VectorStoreEntry | null> {
    const now = getCurrentTimestamp();
    
    // Update last accessed timestamp
    this.db.prepare(
      'UPDATE metadata SET value = ? WHERE key = ?'
    ).run(now, 'lastAccessed');

    const row = this.db.prepare('SELECT e.*, v.embedding FROM entries e LEFT JOIN vector_index v ON e.vector_id = v.id WHERE e.id = ?').get(id) as (DatabaseRow & { embedding: Uint8Array }) | undefined;
    if (!row) return null;

    // Convert Uint8Array back to Float32Array
    const embeddingArray = new Float32Array(row.embedding.buffer);

    return {
      id: row.id,
      content: row.content,
      embedding: Array.from(embeddingArray),
      metadata: JSON.parse(row.metadata.toString()),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async delete(id: string): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Get the vector_id first
      const entry = this.db.prepare('SELECT vector_id FROM entries WHERE id = ?').get(id) as { vector_id: number } | undefined;
      if (entry) {
        // Delete from vector index
        this.db.prepare('DELETE FROM vector_index WHERE id = ?').run(entry.vector_id);
      }

      // Delete from entries table
      this.db.prepare('DELETE FROM entries WHERE id = ?').run(id);

      // Update item count
      this.db.prepare(
        'UPDATE metadata SET value = (SELECT COUNT(*) FROM entries) WHERE key = ?'
      ).run('itemCount');
    });

    transaction();
  }

  async clear(): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Delete from entries table
      this.db.prepare('DELETE FROM entries').run();

      // Delete from vector index
      this.db.prepare('DELETE FROM vector_index').run();

      // Update item count
      this.db.prepare(
        'UPDATE metadata SET value = ? WHERE key = ?'
      ).run('0', 'itemCount');
    });

    transaction();
  }

  async entries(params?: PaginationParams): Promise<PaginatedResult<VectorStoreEntry>> {
    const query = params
      ? 'SELECT e.*, v.embedding FROM entries e LEFT JOIN vector_index v ON e.vector_id = v.id LIMIT ? OFFSET ?'
      : 'SELECT e.*, v.embedding FROM entries e LEFT JOIN vector_index v ON e.vector_id = v.id';
    
    const queryParams = params ? [params.limit, params.offset] : [];
    const rows = this.db.prepare(query).all(...queryParams) as (DatabaseRow & { embedding: Uint8Array })[];

    const items = rows.map(row => {
      // Convert Uint8Array back to Float32Array
      const embeddingArray = new Float32Array(row.embedding.buffer);
      return {
        id: row.id,
        content: row.content,
        embedding: Array.from(embeddingArray),
        metadata: JSON.parse(row.metadata.toString()),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    });

    const count = this.db.prepare('SELECT COUNT(*) as count FROM entries').get() as CountRow;

    return {
      items,
      total: count.count,
      hasMore: params ? params.offset + params.limit < count.count : false
    };
  }

  async search(query: string, topK: number = 5): Promise<VectorStoreEntry[]> {
    const queryEmbedding = await this.generateEmbeddings(query);
    const queryEmbeddingArray = new Float32Array(queryEmbedding);
    const queryEmbeddingBuffer = new Uint8Array(queryEmbeddingArray.buffer);

    const rows = this.db.prepare(
      `SELECT 
        e.*,
        v.embedding,
        v.distance
      FROM entries e
      JOIN vector_index v ON e.vector_id = v.id
      WHERE v.embedding MATCH ? AND k = ?
      ORDER BY distance ASC`
    ).all(queryEmbeddingBuffer, topK) as (DatabaseRow & { embedding: Uint8Array; distance: number })[];

    return rows.map(row => {
      // Convert Uint8Array back to Float32Array
      const embeddingArray = new Float32Array(row.embedding.buffer);
      return {
        id: row.id,
        content: row.content,
        embedding: Array.from(embeddingArray),
        metadata: JSON.parse(row.metadata.toString()),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        similarity: row.distance
      };
    });
  }

  async getMetadata(): Promise<VectorStoreMetadata> {
    const metadataRows = this.db.prepare('SELECT key, value FROM metadata').all() as MetadataRow[];
    const metadata = new Map(metadataRows.map(row => [row.key, row.value]));

    return {
      name: this.storeName,
      partitionKey: this.partitionKey,
      itemCount: parseInt(metadata.get('itemCount') || '0', 10),
      createdAt: metadata.get('createdAt') || '',
      updatedAt: metadata.get('updatedAt') || '',
      lastAccessed: metadata.get('lastAccessed') || ''
    };
  }

  async upsert(entry: VectorStoreEntry): Promise<void> {
    const id = entry.id || generateEntryId();
    await this.set(id, entry);
  }

  getConfig(): VectorStoreConfig {
    return {
      storeName: this.storeName,
      partitionKey: this.partitionKey,
      baseDir: path.dirname(this.dbPath),
      generateEmbeddings: this.generateEmbeddings
    };
  }
}

export function createSQLiteVectorStore(config: VectorStoreConfig): VectorStore {
  return new SQLiteVectorStore(config);
} 