import type { Database } from 'better-sqlite3';
import { Migration, MigrationMetadata } from './types';
import { getCurrentTimestamp } from '../utils';
import { storeMigrations } from './store';
import { managerMigrations } from './manager';

export type MigrationType = 'store' | 'manager';

export class SqliteMigrationManager {
  private db: Database;
  private storeName: string;
  private dbPath: string;
  private migrationType: MigrationType;

  constructor(db: Database, storeName: string, dbPath: string, migrationType: MigrationType) {
    this.db = db;
    this.storeName = storeName;
    this.dbPath = dbPath;
    this.migrationType = migrationType;
    this.initMigrationTable();
  }

  private initMigrationTable(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        appliedAt TEXT NOT NULL,
        type TEXT NOT NULL
      )
    `).run();
  }

  private getCurrentVersion(): number {
    const result = this.db.prepare(
      'SELECT MAX(version) as version FROM migrations WHERE type = ?'
    ).get(this.migrationType) as { version: number | null };
    return result.version || 0;
  }

  private getMigrations(): Migration[] {
    return this.migrationType === 'store' ? storeMigrations : managerMigrations;
  }

  private recordMigration(migration: Migration): void {
    this.db.prepare(`
      INSERT INTO migrations (version, name, appliedAt, type)
      VALUES (?, ?, ?, ?)
    `).run(migration.version, migration.name, getCurrentTimestamp(), this.migrationType);
  }

  migrate(): void {
    console.log(`Running ${this.migrationType} migrations for store '${this.storeName}' at ${this.dbPath}`);
    
    const currentVersion = this.getCurrentVersion();
    const migrations = this.getMigrations();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log(`${this.migrationType} database '${this.storeName}' is up to date (version ${currentVersion})`);
      return;
    }

    console.log(`Current ${this.migrationType} database version: ${currentVersion}`);
    console.log(`Found ${pendingMigrations.length} pending ${this.migrationType} migrations`);

    // Run migrations in a transaction
    const transaction = this.db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(`Applying [${this.migrationType}]:${migration.name} migration version ${migration.version} to '${this.storeName}'...`);
        migration.up(this.db);
        this.recordMigration(migration);
        console.log(`${this.migrationType} migration version ${migration.version} applied successfully to '${this.storeName}'`);
      }
    });

    transaction();
  }

  rollback(targetVersion: number): void {
    console.log(`Rolling back ${this.migrationType} migrations for store '${this.storeName}'`);
    
    const currentVersion = this.getCurrentVersion();
    if (targetVersion >= currentVersion) {
      console.log(`Nothing to rollback for '${this.storeName}' ${this.migrationType} database`);
      return;
    }

    const migrations = this.getMigrations();
    const migrationsToRollback = migrations
      .filter(m => m.version <= currentVersion && m.version > targetVersion)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback

    if (migrationsToRollback.length === 0) {
      console.log(`No migrations to rollback for '${this.storeName}' ${this.migrationType} database`);
      return;
    }

    console.log(`Rolling back '${this.storeName}' ${this.migrationType} database from version ${currentVersion} to ${targetVersion}`);

    // Run rollbacks in a transaction
    const transaction = this.db.transaction(() => {
      for (const migration of migrationsToRollback) {
        console.log(`Rolling back ${this.migrationType} migration version ${migration.version} from '${this.storeName}'...`);
        migration.down(this.db);
        this.db.prepare('DELETE FROM migrations WHERE version = ? AND type = ?').run(migration.version, this.migrationType);
        console.log(`${this.migrationType} migration version ${migration.version} rolled back successfully from '${this.storeName}'`);
      }
    });

    transaction();
  }

  getMigrationHistory(): MigrationMetadata[] {
    return this.db.prepare(`
      SELECT version, name, appliedAt
      FROM migrations
      WHERE type = ?
      ORDER BY version DESC
    `).all(this.migrationType) as MigrationMetadata[];
  }
} 