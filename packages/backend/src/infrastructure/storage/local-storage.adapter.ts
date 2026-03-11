import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { StoragePort, StoredFile } from '../../application/ports/storage.port';

/**
 * STORAGE_TOKEN is the injection token used to bind LocalStorageAdapter
 * to the StoragePort interface in NestJS's dependency injection container.
 *
 * Why a string token instead of the class directly?
 * NestJS can inject concrete classes by their type automatically, but
 * interfaces don't exist at runtime (TypeScript erases them). A string
 * token lets us say: "whenever someone asks for STORAGE_TOKEN, give them
 * a LocalStorageAdapter instance". The use case only knows the interface.
 */
export const STORAGE_TOKEN = 'STORAGE_TOKEN';

@Injectable()
export class LocalStorageAdapter implements StoragePort {
  private readonly logger = new Logger(LocalStorageAdapter.name);

  /**
   * Root directory where uploaded files are stored.
   * Resolved relative to the current working directory of the Node process
   * (the package root in development, the dist root in production).
   * Kept outside the webroot — never served directly by NestJS.
   */
  private readonly uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir ?? join(process.cwd(), 'uploads');
  }

  /**
   * Persists a file buffer to disk under a UUID-based filename.
   *
   * Why UUID for the filename?
   * - Prevents path traversal attacks (e.g. "../../etc/passwd")
   * - Prevents filename collisions between different uploads
   * - Hides internal structure from the outside world
   *
   * The original filename supplied by the user is never used.
   */
  async save(buffer: Buffer, mimeType: string): Promise<StoredFile> {
    await this.ensureUploadDirExists();

    const extension = this.extensionFromMime(mimeType);
    const key = `${randomUUID()}${extension}`;
    const filePath = join(this.uploadDir, key);

    await writeFile(filePath, buffer);

    this.logger.log(`File saved`, { key, sizeBytes: buffer.length, mimeType });

    return {
      key,
      mimeType,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Reads a file from disk and returns its raw bytes.
   * Throws if the file does not exist — callers should check first with
   * a signed URL or handle the error at the use-case level.
   */
  async get(key: string): Promise<Buffer> {
    const filePath = join(this.uploadDir, key);
    const buffer = await readFile(filePath);
    return buffer;
  }

  /**
   * Removes a file from disk.
   * Silently ignores the case where the file does not exist — idempotent,
   * safe to call multiple times.
   */
  async delete(key: string): Promise<void> {
    const filePath = join(this.uploadDir, key);
    try {
      await unlink(filePath);
      this.logger.log(`File deleted`, { key });
    } catch (err: unknown) {
      // ENOENT = file not found — safe to ignore (already deleted or never existed)
      if (this.isNodeError(err) && err.code === 'ENOENT') return;
      throw err;
    }
  }

  /**
   * Returns a time-limited URL that grants access to the file without
   * exposing the raw filesystem path.
   *
   * In production this would be an S3 pre-signed URL. In local development
   * we encode the key and expiry into a base64 token. The controller will
   * validate this token before serving the file (implemented in FASE 9).
   *
   * Format: /files/<base64(key:expiresAt)>
   */
  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const payload = `${key}:${expiresAt}`;
    const token = Buffer.from(payload).toString('base64url');
    return `/files/${token}`;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async ensureUploadDirExists(): Promise<void> {
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Maps a MIME type to a file extension string (including the dot).
   * Falls back to an empty string if the MIME type is unrecognised.
   */
  private extensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/png': '.png',
      'image/jpeg': '.jpg',
    };
    return map[mimeType] ?? '';
  }

  private isNodeError(err: unknown): err is NodeJS.ErrnoException {
    return err instanceof Error && 'code' in err;
  }
}
