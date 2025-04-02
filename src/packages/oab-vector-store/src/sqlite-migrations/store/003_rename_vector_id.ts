import type { Database } from 'better-sqlite3';
import { Migration } from '../types';

export const migration: Migration = {
  version: 3,
  name: 'rename_vector_id',
  up: (db: Database) => {
    // SQLite doesn't support renaming columns directly, so we need to recreate the table
    db.prepare(`
      CREATE TABLE entries_temp (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        sessionId TEXT,
        expiry TEXT,
        vectorId INTEGER
      )
    `).run();

    db.prepare(`
      INSERT INTO entries_temp (id, content, metadata, createdAt, updatedAt, sessionId, expiry, vectorId)
      SELECT id, content, metadata, createdAt, updatedAt, sessionId, expiry, vector_id
      FROM entries
    `).run();

    db.prepare('DROP TABLE entries').run();
    db.prepare('ALTER TABLE entries_temp RENAME TO entries').run();

    // Recreate the index with the new column name
    db.prepare('CREATE INDEX IF NOT EXISTS idx_vector_id ON entries(vectorId)').run();
  },
  down: (db: Database) => {
    // Revert back to vector_id
    db.prepare(`
      CREATE TABLE entries_temp (
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
      INSERT INTO entries_temp (id, content, metadata, createdAt, updatedAt, sessionId, expiry, vector_id)
      SELECT id, content, metadata, createdAt, updatedAt, sessionId, expiry, vectorId
      FROM entries
    `).run();

    db.prepare('DROP TABLE entries').run();
    db.prepare('ALTER TABLE entries_temp RENAME TO entries').run();

    // Recreate the index with the old column name
    db.prepare('CREATE INDEX IF NOT EXISTS idx_vector_id ON entries(vector_id)').run();
  }
}; 