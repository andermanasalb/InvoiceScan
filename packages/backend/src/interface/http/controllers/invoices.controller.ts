/* eslint-disable @typescript-eslint/only-throw-error */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { UploadInvoiceUseCase } from '../../../application/use-cases/upload-invoice.use-case';
import { ListInvoicesUseCase } from '../../../application/use-cases/list-invoices.use-case';
import { GetInvoiceUseCase } from '../../../application/use-cases/get-invoice.use-case';
import { ApproveInvoiceUseCase } from '../../../application/use-cases/approve-invoice.use-case';
import { RejectInvoiceUseCase } from '../../../application/use-cases/reject-invoice.use-case';
import { GetInvoiceEventsUseCase } from '../../../application/use-cases/get-invoice-events.use-case';
import { SendToApprovalUseCase } from '../../../application/use-cases/send-to-approval.use-case';
import { RetryInvoiceUseCase } from '../../../application/use-cases/retry-invoice.use-case';
import { AddNoteUseCase } from '../../../application/use-cases/add-note.use-case';
import { GetInvoiceNotesUseCase } from '../../../application/use-cases/get-invoice-notes.use-case';
import { SendToValidationUseCase } from '../../../application/use-cases/send-to-validation.use-case';
import { FileValidationPipe } from '../pipes/file-validation.pipe';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { Roles } from '../guards/roles.decorator';
import { CurrentUser } from '../guards/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt.strategy';

export const UPLOAD_INVOICE_USE_CASE_TOKEN = 'UPLOAD_INVOICE_USE_CASE_TOKEN';
export const LIST_INVOICES_USE_CASE_TOKEN = 'LIST_INVOICES_USE_CASE_TOKEN';
export const GET_INVOICE_USE_CASE_TOKEN = 'GET_INVOICE_USE_CASE_TOKEN';
export const APPROVE_INVOICE_USE_CASE_TOKEN = 'APPROVE_INVOICE_USE_CASE_TOKEN';
export const REJECT_INVOICE_USE_CASE_TOKEN = 'REJECT_INVOICE_USE_CASE_TOKEN';
export const GET_INVOICE_EVENTS_USE_CASE_TOKEN =
  'GET_INVOICE_EVENTS_USE_CASE_TOKEN';
export const SEND_TO_APPROVAL_USE_CASE_TOKEN =
  'SEND_TO_APPROVAL_USE_CASE_TOKEN';
export const SEND_TO_VALIDATION_USE_CASE_TOKEN =
  'SEND_TO_VALIDATION_USE_CASE_TOKEN';
export const RETRY_INVOICE_USE_CASE_TOKEN = 'RETRY_INVOICE_USE_CASE_TOKEN';
export const ADD_NOTE_USE_CASE_TOKEN = 'ADD_NOTE_USE_CASE_TOKEN';
export const GET_INVOICE_NOTES_USE_CASE_TOKEN =
  'GET_INVOICE_NOTES_USE_CASE_TOKEN';

/**
 * HTTP-layer query schema for GET /invoices.
 *
 * Query params arrive as strings, so we use z.coerce.number() instead of
 * z.number() — the application-layer DTO uses z.number() (already parsed).
 */
const ListInvoicesQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});
type ListInvoicesQuery = z.infer<typeof ListInvoicesQuerySchema>;

/** Body schema for PATCH /invoices/:id/reject */
const RejectBodySchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});
type RejectBody = z.infer<typeof RejectBodySchema>;

/** Body schema for POST /invoices/:id/notes */
const AddNoteBodySchema = z.object({
  content: z.string().min(1, 'content is required').max(2000),
});
type AddNoteBody = z.infer<typeof AddNoteBodySchema>;

/**
 * Body schema for POST /invoices/upload
 *
 * In multipart/form-data requests, text fields arrive alongside the file.
 * Multer parses them and NestJS exposes them via @Body().
 * We validate here that providerId is a non-empty UUID.
 */
const UploadBodySchema = z.object({
  providerId: z.string().uuid({ message: 'providerId must be a valid UUID' }),
});
type UploadBody = z.infer<typeof UploadBodySchema>;

/**
 * InvoicesController
 *
 * Handles all HTTP requests related to invoices.
 * Contains no business logic — it only translates between HTTP and use cases.
 *
 * All endpoints require a valid JWT — enforced globally by JwtAuthGuard.
 * Role enforcement is done per-endpoint via @Roles() + the global RolesGuard.
 */
@Controller('api/v1/invoices')
export class InvoicesController {
  constructor(
    @Inject(UPLOAD_INVOICE_USE_CASE_TOKEN)
    private readonly uploadInvoiceUseCase: UploadInvoiceUseCase,
    @Inject(LIST_INVOICES_USE_CASE_TOKEN)
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    @Inject(GET_INVOICE_USE_CASE_TOKEN)
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    @Inject(APPROVE_INVOICE_USE_CASE_TOKEN)
    private readonly approveInvoiceUseCase: ApproveInvoiceUseCase,
    @Inject(REJECT_INVOICE_USE_CASE_TOKEN)
    private readonly rejectInvoiceUseCase: RejectInvoiceUseCase,
    @Inject(GET_INVOICE_EVENTS_USE_CASE_TOKEN)
    private readonly getInvoiceEventsUseCase: GetInvoiceEventsUseCase,
    @Inject(SEND_TO_APPROVAL_USE_CASE_TOKEN)
    private readonly sendToApprovalUseCase: SendToApprovalUseCase,
    @Inject(SEND_TO_VALIDATION_USE_CASE_TOKEN)
    private readonly sendToValidationUseCase: SendToValidationUseCase,
    @Inject(RETRY_INVOICE_USE_CASE_TOKEN)
    private readonly retryInvoiceUseCase: RetryInvoiceUseCase,
    @Inject(ADD_NOTE_USE_CASE_TOKEN)
    private readonly addNoteUseCase: AddNoteUseCase,
    @Inject(GET_INVOICE_NOTES_USE_CASE_TOKEN)
    private readonly getInvoiceNotesUseCase: GetInvoiceNotesUseCase,
  ) {}

  /**
   * POST /api/v1/invoices/upload
   *
   * Accepts a multipart/form-data request with two parts:
   *   - "file"       : the PDF binary
   *   - "providerId" : UUID of the provider that issued this invoice
   *
   * Multer reads the file into memory (file.buffer) so the FileValidationPipe
   * and the use case can access the raw bytes without touching the filesystem.
   * Text fields in the same multipart form are exposed via @Body().
   *
   * Returns 201 Created with the invoice id and its initial status.
   * The uploaderId is taken from the verified JWT.
   */
  @Post('upload')
  @Roles('uploader', 'validator', 'approver', 'admin')
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
    @Body() body: UploadBody,
  ) {
    const parsed = UploadBodySchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.flatten().fieldErrors.providerId?.join(', ') ??
        'providerId must be a valid UUID';
      throw new BadRequestException(message);
    }

    const result = await this.uploadInvoiceUseCase.execute({
      uploaderId: user.userId,
      providerId: parsed.data.providerId,
      fileBuffer: file.buffer,
      mimeType: file.mimetype as 'application/pdf',
      fileSizeBytes: file.size,
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * GET /api/v1/invoices
   *
   * Returns a paginated list of invoices.
   * - uploaders see only their own invoices
   * - validator / approver / admin see all invoices
   *
   * Query params: status?, page?, limit?, sort?
   */
  @Get()
  @Roles('uploader', 'validator', 'approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(ListInvoicesQuerySchema))
    query: ListInvoicesQuery,
  ) {
    const result = await this.listInvoicesUseCase.execute({
      requesterId: user.userId,
      requesterRole: user.role as
        | 'uploader'
        | 'validator'
        | 'approver'
        | 'admin',
      status: query.status,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    });

    if (result.isErr()) {
      throw result.error;
    }

    const { items, total, page, limit } = result.value;
    return {
      data: items,
      meta: { total, page, limit },
    };
  }

  /**
   * GET /api/v1/invoices/:id
   *
   * Returns the full details of a single invoice.
   * - uploaders can only access their own invoices (use case enforces ownership)
   * - validator / approver / admin can access any invoice
   */
  @Get(':id')
  @Roles('uploader', 'validator', 'approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.getInvoiceUseCase.execute({
      invoiceId,
      requesterId: user.userId,
      requesterRole: user.role as
        | 'uploader'
        | 'validator'
        | 'approver'
        | 'admin',
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * PATCH /api/v1/invoices/:id/approve
   *
   * Approves an invoice. Only approvers and admins can call this.
   * The approverId is taken from the verified JWT.
   */
  @Patch(':id/approve')
  @Roles('approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.approveInvoiceUseCase.execute({
      invoiceId,
      approverId: user.userId,
      approverRole: user.role as 'approver' | 'admin',
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * PATCH /api/v1/invoices/:id/reject
   *
   * Rejects an invoice. Only approvers and admins can call this.
   * Requires a non-empty `reason` in the request body.
   */
  @Patch(':id/reject')
  @Roles('approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body(new ZodValidationPipe(RejectBodySchema)) body: RejectBody,
  ) {
    const result = await this.rejectInvoiceUseCase.execute({
      invoiceId,
      approverId: user.userId,
      approverRole: user.role as 'approver' | 'admin',
      reason: body.reason,
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * GET /api/v1/invoices/:id/events
   *
   * Returns the full state-transition history for a single invoice, ordered
   * chronologically (oldest first).
   * - uploaders can only access events for their own invoices
   * - validator / approver / admin can access any invoice's events
   */
  @Get(':id/events')
  @Roles('uploader', 'validator', 'approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async getEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.getInvoiceEventsUseCase.execute({
      invoiceId,
      requesterId: user.userId,
      requesterRole: user.role as
        | 'uploader'
        | 'validator'
        | 'approver'
        | 'admin',
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * PATCH /api/v1/invoices/:id/send-to-validation
   *
   * Moves an EXTRACTED invoice to READY_FOR_VALIDATION.
   * The uploader reviews the AI-extracted data and sends it to validation.
   * Validators, approvers, and admins can also call this.
   */
  @Patch(':id/send-to-validation')
  @Roles('uploader', 'validator', 'approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async sendToValidation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.sendToValidationUseCase.execute({
      invoiceId,
      validatorId: user.userId,
      validatorRole: user.role as
        | 'uploader'
        | 'validator'
        | 'approver'
        | 'admin',
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * PATCH /api/v1/invoices/:id/send-to-approval
   *
   * Moves a READY_FOR_VALIDATION invoice to READY_FOR_APPROVAL.
   * Only approvers and admins can call this.
   * The same person who moved it to READY_FOR_VALIDATION cannot also call this
   * (unless they are admin).
   */
  @Patch(':id/send-to-approval')
  @Roles('approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async sendToApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.sendToApprovalUseCase.execute({
      invoiceId,
      validatorId: user.userId,
      validatorRole: user.role as 'validator' | 'approver' | 'admin',
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * PATCH /api/v1/invoices/:id/retry
   *
   * Retries a VALIDATION_FAILED invoice by moving it back to PROCESSING
   * and re-enqueuing the OCR job.
   * Validators, approvers, and admins can call this.
   */
  @Patch(':id/retry')
  @Roles('validator', 'approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.retryInvoiceUseCase.execute({
      invoiceId,
      requesterId: user.userId,
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * GET /api/v1/invoices/:id/notes
   *
   * Returns all notes for a single invoice, ordered chronologically.
   * - uploaders can only access notes for their own invoices
   * - validator / approver / admin can access any invoice's notes
   */
  @Get(':id/notes')
  @Roles('uploader', 'validator', 'approver', 'admin')
  @HttpCode(HttpStatus.OK)
  async getNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
  ) {
    const result = await this.getInvoiceNotesUseCase.execute({
      invoiceId,
      requesterId: user.userId,
      requesterRole: user.role as
        | 'uploader'
        | 'validator'
        | 'approver'
        | 'admin',
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }

  /**
   * POST /api/v1/invoices/:id/notes
   *
   * Adds a note to an invoice.
   * Validators, approvers, and admins can add notes.
   */
  @Post(':id/notes')
  @Roles('validator', 'approver', 'admin')
  @HttpCode(HttpStatus.CREATED)
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body(new ZodValidationPipe(AddNoteBodySchema)) body: AddNoteBody,
  ) {
    const result = await this.addNoteUseCase.execute({
      invoiceId,
      authorId: user.userId,
      content: body.content,
    });

    if (result.isErr()) {
      throw result.error;
    }

    return {
      data: result.value,
    };
  }
}
