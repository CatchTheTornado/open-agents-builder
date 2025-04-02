import path from 'path';
import fs from 'fs';

/**
 * StorageService handles reading/writing files to disk with concurrency locks
 * and a variety of helper methods for plain text, JSON, or binary attachments.
 */
export class StorageService {
  private rootPath: string;
  private uploadPath: string;
  private schema: string;

  constructor(databaseIdHash: string, schema: string) {
    this.rootPath = path.resolve(process.cwd());
    this.uploadPath = path.join(this.rootPath, 'data', databaseIdHash, schema);
    this.schema = schema;
  }

  /**
   * Ensures that the target directory (uploadPath) exists.
   */
  private ensureDirExists(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  /**
   * Resolve the absolute path for a particular storage key (file name).
   */
  private getFilePath(storageKey: string): string {
    return path.resolve(this.uploadPath, storageKey);
  }

  /**
   * Resolve the absolute path for the lock file used by concurrency.
   */
  private getLockFilePath(storageKey: string): string {
    return `${this.getFilePath(storageKey)}.lock`;
  }

  /**
   * Simple helper to wait between lock acquisition attempts.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Acquire an exclusive lock on a file by creating a ".lock" next to it.
   */
  public async acquireLock(storageKey: string, maxAttempts = 50, attemptDelayMs = 100): Promise<void> {
    const lockFilePath = this.getLockFilePath(storageKey);
    let attempts = 0;

    while (fs.existsSync(lockFilePath)) {
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error(`Could not acquire lock for "${storageKey}" after ${maxAttempts} attempts`);
      }
      await this.delay(attemptDelayMs);
    }

    fs.writeFileSync(lockFilePath, '');
  }

  /**
   * Release the lock by removing the ".lock" file.
   */
  public releaseLock(storageKey: string): void {
    const lockFilePath = this.getLockFilePath(storageKey);
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  }

  /**
   * Save a binary attachment from a File object (browser File).
   */
  public async saveAttachment(file: File, storageKey: string): Promise<void> {
    this.ensureDirExists();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    fs.writeFileSync(this.getFilePath(storageKey), buffer);
  }

  /**
   * Save a binary attachment from a base64 string.
   */
  public async saveAttachmentFromBase64(base64: string, storageKey: string): Promise<void> {
    this.ensureDirExists();
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(this.getFilePath(storageKey), buffer);
  }

  /**
   * Save a plain-text file (UTF-8).
   */
  public async savePlainTextAttachment(text: string, storageKey: string): Promise<void> {
    this.ensureDirExists();
    fs.writeFileSync(this.getFilePath(storageKey), text, 'utf8');
  }

  /**
   * Read a plain-text file (UTF-8).
   */
  public readPlainTextAttachment(storageKey: string): string {
    const filePath = this.getFilePath(storageKey);
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Check if a file exists.
   */
  public fileExists(storageKey: string): boolean {
    const filePath = this.getFilePath(storageKey);
    return fs.existsSync(filePath);
  }

  /**
   * Read a binary attachment as an ArrayBuffer.
   */
  public readAttachment(storageKey: string): ArrayBuffer {
    const filePath = this.getFilePath(storageKey);
    const buffer = fs.readFileSync(filePath);
    return new Uint8Array(buffer).buffer;
  }

  /**
   * Read a binary attachment as a base64 data URI string (with mimeType).
   */
  public readAttachmentAsBase64WithMimeType(storageKey: string, mimeType: string): string {
    const filePath = this.getFilePath(storageKey);
    const buffer = fs.readFileSync(filePath).toString('base64');
    return `data:${mimeType};base64,${buffer}`;
  }

  /**
   * Delete a file by its storage key.
   */
  public deleteAttachment(storageKey: string): void {
    const filePath = this.getFilePath(storageKey);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
  }

  /**
   * Read a JSON file from disk and parse it. Returns {} if not found.
   */
  public readPlainJSONAttachment<T = any>(storageKey: string): T {
    this.ensureDirExists();
    const filePath = this.getFilePath(storageKey);
    if (!fs.existsSync(filePath)) {
      return {} as T;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  /**
   * Writes data as JSON to disk. Checks size against maxFileSizeMB (default 10).
   */
  public writePlainJSONAttachment(storageKey: string, data: any, maxFileSizeMB = 10): void {
    this.ensureDirExists();
    const jsonString = JSON.stringify(data);
    const size = Buffer.byteLength(jsonString, 'utf8');

    if (size > maxFileSizeMB * 1024 * 1024) {
      throw new Error(`File size limit of ${maxFileSizeMB}MB exceeded for ${storageKey}.`);
    }

    fs.writeFileSync(this.getFilePath(storageKey), jsonString, 'utf8');
  }


}
