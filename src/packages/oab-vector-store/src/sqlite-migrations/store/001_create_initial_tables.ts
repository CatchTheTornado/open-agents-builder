import type { Database } from 'better-sqlite3';
import { Migration } from '../types';
import { getCurrentTimestamp } from '../../utils';

export const migration: Migration = {
  version: 1,
  name: 'create_initial_tables',
  up: (db: Database) => {
    // Create base tables
    db.prepare(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        sessionId TEXT,
        expiry TEXT,
        vector_id INTEGER
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `).run();

    // Initialize metadata
    const now = getCurrentTimestamp();
    const metadataRows = [
      { key: 'itemCount', value: '0' },
      { key: 'createdAt', value: now },
      { key: 'updatedAt', value: now },
      { key: 'lastAccessed', value: now }
    ];

    for (const row of metadataRows) {
      db.prepare('INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)').run(row.key, row.value);
    }

    // Create index on vector_id
    db.prepare('CREATE INDEX IF NOT EXISTS idx_vector_id ON entries(vector_id)').run();

    // Create vector index virtual table
    db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vector_index USING vec0(
        id integer primary key autoincrement,
        embedding float[1536]
      )
    `).run();
  },
  down: (db: Database) => {
    // Drop tables in reverse order of creation
    db.prepare('DROP TABLE IF EXISTS vector_index').run();
    db.prepare('DROP TABLE IF EXISTS metadata').run();
    db.prepare('DROP TABLE IF EXISTS entries').run();
  }
}; 