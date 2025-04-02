import type { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Migration, MigrationMetadata } from './types';
import { getCurrentTimestamp } from '../utils';

export class MigrationManager {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.initMigrationTable();
  }

  private initMigrationTable(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        appliedAt TEXT NOT NULL
      )
    `).run();
  }

  private getCurrentVersion(): number {
    const result = this.db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null };
    return result.version || 0;
  }

  private async loadMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .filter(file => !file.includes('types') && !file.includes('migration-manager'));

    const migrations: Migration[] = [];
    for (const file of files) {
      const module = await import(path.join(migrationsDir, file));
      if (module.migration && typeof module.migration.version === 'number') {
        migrations.push(module.migration);
      }
    }

    // Sort migrations by version
    return migrations.sort((a, b) => a.version - b.version);
  }

  private recordMigration(migration: Migration): void {
    this.db.prepare(`
      INSERT INTO migrations (version, name, appliedAt)
      VALUES (?, ?, ?)
    `).run(migration.version, migration.constructor.name, getCurrentTimestamp());
  }

  async migrate(): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    const migrations = await this.loadMigrations();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('Database is up to date');
      return;
    }

    console.log(`Current database version: ${currentVersion}`);
    console.log(`Found ${pendingMigrations.length} pending migrations`);

    // Run migrations in a transaction
    const transaction = this.db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(`Applying migration version ${migration.version}...`);
        migration.up(this.db);
        this.recordMigration(migration);
        console.log(`Migration version ${migration.version} applied successfully`);
      }
    });

    transaction();
  }

  async rollback(targetVersion: number): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    if (targetVersion >= currentVersion) {
      console.log('Nothing to rollback');
      return;
    }

    const migrations = await this.loadMigrations();
    const migrationsToRollback = migrations
      .filter(m => m.version <= currentVersion && m.version > targetVersion)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback

    if (migrationsToRollback.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    console.log(`Rolling back from version ${currentVersion} to ${targetVersion}`);

    // Run rollbacks in a transaction
    const transaction = this.db.transaction(() => {
      for (const migration of migrationsToRollback) {
        console.log(`Rolling back migration version ${migration.version}...`);
        migration.down(this.db);
        this.db.prepare('DELETE FROM migrations WHERE version = ?').run(migration.version);
        console.log(`Migration version ${migration.version} rolled back successfully`);
      }
    });

    transaction();
  }

  getMigrationHistory(): MigrationMetadata[] {
    return this.db.prepare(`
      SELECT version, name, appliedAt
      FROM migrations
      ORDER BY version DESC
    `).all() as MigrationMetadata[];
  }
} 