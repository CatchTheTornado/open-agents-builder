import path from 'path';

/**
 * Returns the absolute path to the data directory for a specific database.
 * This is used for storing vector stores and other data.
 * @param databaseIdHash The hash of the database ID
 * @param storeName The name of the store (defaults to 'memory-store')
 */
export function getDataDir(databaseIdHash: string, storeName: string = 'memory-store'): string {
  return path.resolve(process.cwd(), 'data', databaseIdHash, storeName);
} 