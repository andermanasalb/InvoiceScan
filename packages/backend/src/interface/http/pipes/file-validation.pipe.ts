import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/**
 * Maximum allowed upload size in bytes.
 * Reads MAX_UPLOAD_SIZE_MB from the environment (defaults to 10).
 * Computed once at module load time — no per-request overhead.
 */
const MAX_SIZE_BYTES =
  (parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '10', 10) || 10) * 1024 * 1024;

/**
 * The only MIME type we accept.
 * Checked against the *real* type detected from magic bytes, not the
 * Content-Type header that the client sends (which can be spoofed).
 */
const ALLOWED_MIME = 'application/pdf';

/**
 * FileValidationPipe
 *
 * A NestJS pipe that runs before the controller receives the uploaded file.
 * It enforces three rules, in order:
 *
 *   1. A file must be present.
 *   2. The file must not exceed MAX_UPLOAD_SIZE_MB.
 *   3. The real MIME type (detected from magic bytes) must be application/pdf.
 *
 * If any rule fails, NestJS automatically returns HTTP 400 Bad Request and
 * the controller is never called.
 *
 * Why validate MIME from magic bytes instead of the Content-Type header?
 * The Content-Type header is set by the client — it can say "application/pdf"
 * even if the file is actually an executable. Magic bytes are the first few
 * bytes written into the file itself by the program that created it, and
 * cannot be faked without corrupting the file.
 *
 * Example magic bytes:
 *   PDF  →  25 50 44 46  (%PDF)
 *   PNG  →  89 50 4E 47  (.PNG)
 *   EXE  →  4D 5A        (MZ)
 */
@Injectable()
export class FileValidationPipe
  implements PipeTransform<Express.Multer.File, Promise<Express.Multer.File>>
{
  async transform(
    file: Express.Multer.File,
    _meta: ArgumentMetadata,
  ): Promise<Express.Multer.File> {
    // Rule 1 — file must exist
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    // Rule 2 — size limit
    if (file.size > MAX_SIZE_BYTES) {
      const limitMb = MAX_SIZE_BYTES / 1024 / 1024;
      throw new BadRequestException(
        `File exceeds the maximum allowed size of ${limitMb} MB.`,
      );
    }

    // Rule 3 — real MIME type from magic bytes
    //
    // file-type is a pure ESM package. NestJS compiles to CommonJS, so we
    // cannot use a top-level import. Dynamic import() is the correct bridge:
    // it works in CommonJS modules and returns a Promise that resolves to the
    // ESM module's exports.
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);

    if (!detected || detected.mime !== ALLOWED_MIME) {
      throw new BadRequestException(
        `Invalid file type. Only PDF files are accepted (detected: ${detected?.mime ?? 'unknown'}).`,
      );
    }

    return file;
  }
}
