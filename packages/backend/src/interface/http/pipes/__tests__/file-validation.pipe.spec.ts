import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { FileValidationPipe } from '../file-validation.pipe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal fake Multer file object.
 * Only the fields the pipe actually reads are populated.
 */
function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'invoice.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf', // client-supplied — the pipe does NOT trust this
    buffer: makePdfBuffer(),
    size: makePdfBuffer().length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

/**
 * A minimal valid PDF buffer.
 * PDF magic bytes are the ASCII string "%PDF" followed by a version number.
 * file-type reads the first few bytes to identify the format — this is enough.
 */
function makePdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4 minimal', 'ascii');
}

/**
 * A buffer that looks like a PNG.
 * PNG magic bytes: 0x89 P N G \r \n 0x1a \n
 * file-type needs the IHDR chunk (which starts at byte 8) to confirm PNG,
 * so we include the full signature + a minimal IHDR chunk (25 bytes total).
 * Without enough bytes file-type returns undefined instead of image/png.
 */
function makePngBuffer(): Buffer {
  // PNG signature (8 bytes) + IHDR chunk length (4) + "IHDR" (4) + IHDR data (13)
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d, // IHDR chunk length = 13
    0x49,
    0x48,
    0x44,
    0x52, // "IHDR"
    0x00,
    0x00,
    0x00,
    0x01, // width = 1
    0x00,
    0x00,
    0x00,
    0x01, // height = 1
    0x08,
    0x02,
    0x00,
    0x00,
    0x00, // bit depth, color type, etc.
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileValidationPipe', () => {
  const pipe: FileValidationPipe = new FileValidationPipe();

  // --- missing file ---

  describe('when no file is provided', () => {
    it('should throw BadRequestException', async () => {
      await expect(pipe.transform(undefined as any, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include a descriptive message', async () => {
      await expect(pipe.transform(undefined as any, {} as any)).rejects.toThrow(
        'No file uploaded',
      );
    });
  });

  // --- size limit ---

  describe('when the file exceeds the size limit', () => {
    it('should throw BadRequestException', async () => {
      const oversized = makeFile({
        buffer: Buffer.alloc(11 * 1024 * 1024), // 11 MB
        size: 11 * 1024 * 1024,
      });

      await expect(pipe.transform(oversized, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mention the size limit in the message', async () => {
      const oversized = makeFile({
        buffer: Buffer.alloc(11 * 1024 * 1024),
        size: 11 * 1024 * 1024,
      });

      await expect(pipe.transform(oversized, {} as any)).rejects.toThrow(
        /maximum allowed size/,
      );
    });
  });

  // --- wrong MIME type ---

  describe('when the file is not a PDF', () => {
    it('should throw BadRequestException for a PNG disguised as PDF', async () => {
      // Client claims it is a PDF but the magic bytes say PNG
      const fakePdf = makeFile({
        mimetype: 'application/pdf',
        buffer: makePngBuffer(),
        size: makePngBuffer().length,
      });

      await expect(pipe.transform(fakePdf, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mention the detected type in the message', async () => {
      const fakePdf = makeFile({
        mimetype: 'application/pdf',
        buffer: makePngBuffer(),
        size: makePngBuffer().length,
      });

      await expect(pipe.transform(fakePdf, {} as any)).rejects.toThrow(
        /image\/png/,
      );
    });

    it('should throw for a buffer with unknown magic bytes', async () => {
      const garbage = makeFile({
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
        size: 4,
      });

      await expect(pipe.transform(garbage, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // --- valid file ---

  describe('when the file is a valid PDF within the size limit', () => {
    it('should return the file unchanged', async () => {
      const valid = makeFile();

      const result = await pipe.transform(valid, {} as any);

      expect(result).toBe(valid);
    });

    it('should accept a PDF right at the size limit', async () => {
      // Exactly 10 MB — should pass
      const atLimit = makeFile({
        buffer: (() => {
          // Start with PDF magic bytes so file-type recognises it, then pad
          const buf = Buffer.alloc(10 * 1024 * 1024);
          Buffer.from('%PDF-1.4 ', 'ascii').copy(buf);
          return buf;
        })(),
        size: 10 * 1024 * 1024,
      });

      await expect(pipe.transform(atLimit, {} as any)).resolves.toBe(atLimit);
    });
  });
});
