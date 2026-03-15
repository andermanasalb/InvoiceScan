import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { ExportInvoicesUseCase } from '../../../application/use-cases/export-invoices.use-case';
import type { ExportInvoicesInput } from '../../../application/dtos/export-invoices.dto';
import { Roles } from '../guards/roles.decorator';
import { CurrentUser } from '../guards/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt.strategy';
import { EXPORT_INVOICE_QUEUE } from '../../../infrastructure/queue/export-queue.service';

export const EXPORT_INVOICES_USE_CASE_TOKEN = 'EXPORT_INVOICES_USE_CASE_TOKEN';

/** Query schema for POST /invoices/export */
const ExportBodySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.string().optional(),
  sort: z.string().optional(),
});
type ExportBody = z.infer<typeof ExportBodySchema>;

/**
 * ExportsController
 *
 * POST /api/v1/invoices/export  → enqueue export job, return { jobId }
 * GET  /api/v1/exports/:jobId/status → poll job status + downloadUrl
 * GET  /api/v1/exports/:jobId/download → stream the file to the client
 *
 * Only validator, approver and admin can export (bulk management action).
 */
@Controller('api/v1')
export class ExportsController {
  private readonly exportsDir = join(process.cwd(), 'exports');

  constructor(
    @Inject(EXPORT_INVOICES_USE_CASE_TOKEN)
    private readonly exportInvoicesUseCase: ExportInvoicesUseCase,
    @InjectQueue(EXPORT_INVOICE_QUEUE)
    private readonly exportQueue: Queue,
  ) {}

  /**
   * POST /api/v1/invoices/export
   *
   * Enqueues an async export job and returns { jobId } immediately.
   * The client polls GET /api/v1/exports/:jobId/status until done.
   */
  @Post('invoices/export')
  @Roles('validator', 'approver', 'admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestExport(
    @Query() query: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { jobId: string } }> {
    const parsed = ExportBodySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const body: ExportBody = parsed.data;

    const result = await this.exportInvoicesUseCase.execute({
      requesterId: user.userId,
      requesterRole: user.role as ExportInvoicesInput['requesterRole'],
      format: body.format,
      status: body.status,
      sort: body.sort,
    });

    if (result.isErr()) {
      throw new BadRequestException(result.error.message);
    }

    return { data: { jobId: result.value.jobId } };
  }

  /**
   * GET /api/v1/exports/:jobId/status
   *
   * Returns the current state of the export job.
   * When complete, includes a downloadUrl pointing to the download endpoint.
   *
   * Possible statuses: 'pending' | 'processing' | 'done' | 'failed'
   */
  @Get('exports/:jobId/status')
  @Roles('validator', 'approver', 'admin')
  async getExportStatus(@Param('jobId') jobId: string): Promise<{
    data: {
      status: 'pending' | 'processing' | 'done' | 'failed';
      progress: number;
      downloadUrl: string | null;
      format: string | null;
    };
  }> {
    const job = await this.exportQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    const state = await job.getState();
    const format = (job.data as { format?: string }).format ?? null;
    const ext = format === 'json' ? 'json' : 'csv';

    let status: 'pending' | 'processing' | 'done' | 'failed';
    let progress = 0;
    let downloadUrl: string | null = null;

    switch (state) {
      case 'waiting':
      case 'delayed':
        status = 'pending';
        break;
      case 'active':
        status = 'processing';
        progress = 50;
        break;
      case 'completed':
        status = 'done';
        progress = 100;
        downloadUrl = `/api/v1/exports/${jobId}/download?ext=${ext}`;
        break;
      case 'failed':
        status = 'failed';
        break;
      default:
        status = 'pending';
    }

    return { data: { status, progress, downloadUrl, format } };
  }

  /**
   * GET /api/v1/exports/:jobId/download
   *
   * Streams the generated export file to the client.
   * The file must exist on disk (job must be completed).
   */
  @Get('exports/:jobId/download')
  @Roles('validator', 'approver', 'admin')
  downloadExport(
    @Param('jobId') jobId: string,
    @Query('ext') ext: string,
    @Res() res: Response,
  ): void {
    const safeExt = ext === 'json' ? 'json' : 'csv';
    const filePath = join(this.exportsDir, `${jobId}.${safeExt}`);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Export file not ready or not found');
    }

    const contentType =
      safeExt === 'json' ? 'application/json' : 'text/csv; charset=utf-8';
    const filename = `invoices-export-${jobId}.${safeExt}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    createReadStream(filePath).pipe(res);
  }
}
