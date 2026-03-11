import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadInvoiceUseCase } from '../../../application/use-cases/upload-invoice.use-case';
import { FileValidationPipe } from '../pipes/file-validation.pipe';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../guards/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt.strategy';

export const UPLOAD_INVOICE_USE_CASE_TOKEN = 'UPLOAD_INVOICE_USE_CASE_TOKEN';

/**
 * InvoicesController
 *
 * Handles all HTTP requests related to invoices.
 * Contains no business logic — it only translates between HTTP and use cases.
 *
 * All endpoints require a valid JWT (JwtAuthGuard).
 */
@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard)
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
   * The uploaderId is taken from the verified JWT (no more placeholder UUID).
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
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(new FileValidationPipe())
    file: Express.Multer.File,
  ) {
    // TODO (FASE 9): accept providerId from request body once providers exist
    const PLACEHOLDER_PROVIDER_ID = '00000000-0000-0000-0000-000000000002';

    const result = await this.uploadInvoiceUseCase.execute({
      uploaderId: user.userId,
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
