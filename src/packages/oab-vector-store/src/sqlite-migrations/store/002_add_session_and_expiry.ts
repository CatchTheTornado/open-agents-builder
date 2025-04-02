import type { Database } from 'better-sqlite3';
import { Migration } from '../types';

export const migration: Migration = {
  version: 2,
  name: 'add_session_and_expiry',
  up: (db: Database) => {
    // Add new columns
    db.prepare(`
      ALTER TABLE entries
      ADD COLUMN sessionId TEXT;
    `).run();

    db.prepare(`
      ALTER TABLE entries
      ADD COLUMN expiry TEXT;
    `).run();
  },
  down: (db: Database) => {
    // SQLite doesn't support dropping columns directly
    // We need to recreate the table without these columns
    db.prepare(`
      CREATE TABLE entries_temp (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        vector_id INTEGER
      );
    `).run();

    db.prepare(`
      INSERT INTO entries_temp (id, content, metadata, createdAt, updatedAt, vector_id)
      SELECT id, content, metadata, createdAt, updatedAt, vector_id
      FROM entries;
    `).run();

    db.prepare('DROP TABLE entries;').run();
    db.prepare('ALTER TABLE entries_temp RENAME TO entries;').run();
  }
}; 