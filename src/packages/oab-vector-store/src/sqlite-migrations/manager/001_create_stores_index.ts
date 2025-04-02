import type { Database } from 'better-sqlite3';
import { Migration } from '../types';

export const migration: Migration = {
  version: 1,
  name: 'create_stores_index',
  up: (db: Database) => {
    // Create stores index table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS stores_index (
        partitionKey TEXT NOT NULL,
        storeName TEXT NOT NULL,
        baseDir TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastAccessed TEXT,
        PRIMARY KEY (partitionKey, storeName)
      )
    `).run();

    // Create index for faster lookups
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_stores_partition 
      ON stores_index(partitionKey)
    `).run();
  },
  down: (db: Database) => {
    db.prepare('DROP TABLE IF EXISTS stores_index').run();
  }
}; 