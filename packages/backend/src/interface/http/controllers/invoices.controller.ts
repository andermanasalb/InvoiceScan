import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadInvoiceUseCase } from '../../../application/use-cases/upload-invoice.use-case';
import { FileValidationPipe } from '../pipes/file-validation.pipe';

export const UPLOAD_INVOICE_USE_CASE_TOKEN = 'UPLOAD_INVOICE_USE_CASE_TOKEN';

/**
 * InvoicesController
 *
 * Handles all HTTP requests related to invoices.
 * Contains no business logic — it only translates between HTTP and use cases.
 *
 * Auth note: uploaderId is hardcoded as a placeholder until FASE 8 adds
 * JWT authentication. At that point it will be replaced with the user id
 * extracted from the verified JWT token.
 */
@Controller('api/v1/invoices')
export class InvoicesController {
  constructor(
    @Inject(UPLOAD_INVOICE_USE_CASE_TOKEN)
    private readonly uploadInvoiceUseCase: UploadInvoiceUseCase,
  ) {}

  /**
   * POST /api/v1/invoices/upload
   *
   * Accepts a single PDF file via multipart/form-data under the field
   * name "file". Multer reads the file into memory (file.buffer) so the
   * FileValidationPipe and the use case can access the raw bytes without
   * touching the filesystem at this layer.
   *
   * Returns 201 Created with the invoice id and its initial status.
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      // Store in memory — we pass the Buffer directly to the use case.
      // The LocalStorageAdapter is responsible for writing to disk.
      storage: memoryStorage(),
    }),
  )
  async upload(
    @UploadedFile(new FileValidationPipe())
    file: Express.Multer.File,
  ) {
    // TODO (FASE 8): replace with authenticated user id from JWT
    const PLACEHOLDER_UPLOADER_ID = '00000000-0000-0000-0000-000000000001';
    // TODO (FASE 9): accept providerId from request body once providers exist
    const PLACEHOLDER_PROVIDER_ID = '00000000-0000-0000-0000-000000000002';

    const result = await this.uploadInvoiceUseCase.execute({
      uploaderId: PLACEHOLDER_UPLOADER_ID,
      providerId: PLACEHOLDER_PROVIDER_ID,
      fileBuffer: file.buffer,
      mimeType: file.mimetype as 'application/pdf',
      fileSizeBytes: file.size,
    });

    if (result.isErr()) {
      // Domain errors that reach the controller are unexpected at this stage.
      // FASE 9 will add a proper exception filter that maps each DomainError
      // variant to its specific HTTP status code.
      throw new InternalServerErrorException(result.error.message);
    }

    return {
      data: result.value,
    };
  }
}
