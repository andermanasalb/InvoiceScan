import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../local-storage.adapter';

/**
 * Uses a real temporary directory so we test actual filesystem behaviour,
 * not a mock. The directory is created before the suite and wiped after.
 */
const TEST_UPLOAD_DIR = join(process.cwd(), 'test-uploads-tmp');

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;

  beforeAll(async () => {
    await mkdir(TEST_UPLOAD_DIR, { recursive: true });
    adapter = new LocalStorageAdapter(TEST_UPLOAD_DIR);
  });

  afterAll(async () => {
    await rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Wipe directory contents between tests so each starts clean
    await rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
    await mkdir(TEST_UPLOAD_DIR, { recursive: true });
  });

  // --- save ---

  describe('save', () => {
    it('should write the file to disk and return a StoredFile', async () => {
      const buffer = Buffer.from('fake-pdf-content');
      const mimeType = 'application/pdf';

      const stored = await adapter.save(buffer, mimeType);

      expect(stored.key).toMatch(/^[0-9a-f-]{36}\.pdf$/); // UUID + .pdf extension
      expect(stored.mimeType).toBe(mimeType);
      expect(stored.sizeBytes).toBe(buffer.length);
      expect(existsSync(join(TEST_UPLOAD_DIR, stored.key))).toBe(true);
    });

    it('should generate a unique key on each call', async () => {
      const buffer = Buffer.from('content');

      const a = await adapter.save(buffer, 'application/pdf');
      const b = await adapter.save(buffer, 'application/pdf');

      expect(a.key).not.toBe(b.key);
    });

    it('should create the upload directory if it does not exist', async () => {
      const newDir = join(process.cwd(), 'test-uploads-autocreate-tmp');
      const adapterWithNewDir = new LocalStorageAdapter(newDir);

      try {
        const stored = await adapterWithNewDir.save(
          Buffer.from('x'),
          'application/pdf',
        );
        expect(existsSync(join(newDir, stored.key))).toBe(true);
      } finally {
        await rm(newDir, { recursive: true, force: true });
      }
    });

    it('should use empty extension for unknown MIME types', async () => {
      const stored = await adapter.save(
        Buffer.from('data'),
        'application/octet-stream',
      );
      // No dot in the key means no extension was appended
      expect(stored.key).not.toContain('.');
    });
  });

  // --- get ---

  describe('get', () => {
    it('should return the same bytes that were saved', async () => {
      const original = Buffer.from('hello invoice');
      const { key } = await adapter.save(original, 'application/pdf');

      const retrieved = await adapter.get(key);

      expect(retrieved).toEqual(original);
    });

    it('should throw when the key does not exist', async () => {
      await expect(adapter.get('nonexistent.pdf')).rejects.toThrow();
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('should remove the file from disk', async () => {
      const { key } = await adapter.save(
        Buffer.from('to delete'),
        'application/pdf',
      );

      await adapter.delete(key);

      expect(existsSync(join(TEST_UPLOAD_DIR, key))).toBe(false);
    });

    it('should not throw when deleting a non-existent key', async () => {
      await expect(adapter.delete('ghost.pdf')).resolves.not.toThrow();
    });
  });

  // --- getSignedUrl ---

  describe('getSignedUrl', () => {
    it('should return a URL string starting with /files/', async () => {
      const url = await adapter.getSignedUrl('some-key.pdf');
      expect(url).toMatch(/^\/files\//);
    });

    it('should encode the key inside the token', async () => {
      const key = 'my-file.pdf';
      const url = await adapter.getSignedUrl(key);

      // Token is the part after /files/
      const token = url.replace('/files/', '');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');

      expect(decoded).toContain(key);
    });

    it('should encode the expiry timestamp inside the token', async () => {
      const before = Date.now();
      const url = await adapter.getSignedUrl('file.pdf', 60);
      const after = Date.now();

      const token = url.replace('/files/', '');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const expiresAt = parseInt(decoded.split(':')[1], 10);

      expect(expiresAt).toBeGreaterThanOrEqual(before + 60_000);
      expect(expiresAt).toBeLessThanOrEqual(after + 60_000);
    });
  });
});
