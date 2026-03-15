import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { EXPORT_INVOICE_QUEUE } from '../../infrastructure/queue/export-queue.service';
import type { InvoiceRepository } from '../../domain/repositories';
import type { AssignmentRepository } from '../../domain/repositories/assignment.repository';

import type { ExportJobOptions } from '../../application/ports/export-queue.port';
import type { Invoice } from '../../domain/entities';
import { UserRole } from '../../domain/entities/user.entity';

export const EXPORT_INVOICE_REPOSITORY_TOKEN = 'ExportInvoiceRepository';
export const EXPORT_ASSIGNMENT_REPOSITORY_TOKEN = 'ExportAssignmentRepository';

export interface ExportJobData extends ExportJobOptions {
  jobId: string;
}

/**
 * ExportInvoicesWorker
 *
 * Consumes jobs from the 'export-invoices' BullMQ queue.
 * For each job:
 *   1. Fetches all matching invoices (respects requester role scoping).
 *   2. Serialises them to CSV or JSON.
 *   3. Writes the file to disk under exports/<jobId>.<ext>.
 *
 * The ExportsController serves the file once the job is complete.
 * Idempotent: writing the same jobId twice is safe (overwrites same file).
 */
@Processor(EXPORT_INVOICE_QUEUE)
@Injectable()
export class ExportInvoicesWorker extends WorkerHost {
  private readonly exportsDir = join(process.cwd(), 'exports');

  constructor(
    @InjectPinoLogger(ExportInvoicesWorker.name)
    private readonly logger: PinoLogger,
    @Inject(EXPORT_INVOICE_REPOSITORY_TOKEN)
    private readonly invoiceRepo: InvoiceRepository,
    @Inject(EXPORT_ASSIGNMENT_REPOSITORY_TOKEN)
    private readonly assignmentRepo: AssignmentRepository,
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    const { jobId, format, requesterId, requesterRole, status, sort } =
      job.data;

    this.logger.info({ jobId, format, requesterRole }, 'Export job started');

    // Fetch ALL matching invoices (no pagination — export is full dataset)
    const filters = { status, sort, page: 1, limit: 100_000 };
    const invoices = await this.fetchInvoices(
      requesterId,
      requesterRole,
      filters,
    );

    this.logger.info(
      { jobId, count: invoices.length },
      'Fetched invoices for export',
    );

    // Serialise
    const content =
      format === 'csv'
        ? this.toCsv(invoices)
        : JSON.stringify(this.toJsonArray(invoices), null, 2);

    // Write file
    await this.ensureExportsDirExists();
    const ext = format === 'csv' ? 'csv' : 'json';
    const filePath = join(this.exportsDir, `${jobId}.${ext}`);
    await writeFile(filePath, content, 'utf8');

    this.logger.info({ jobId, filePath }, 'Export file written');
  }

  // ---------------------------------------------------------------------------
  // Role-scoped invoice fetching (mirrors ListInvoicesUseCase logic)
  // ---------------------------------------------------------------------------

  private async fetchInvoices(
    requesterId: string,
    requesterRole: string,
    filters: { status?: string; sort?: string; page: number; limit: number },
  ): Promise<Invoice[]> {
    if (requesterRole === UserRole.UPLOADER) {
      const result = await this.invoiceRepo.findByUploaderId(
        requesterId,
        filters,
      );
      return result.items;
    }

    if (requesterRole === UserRole.VALIDATOR) {
      const assignedUploaderIds =
        await this.assignmentRepo.getAssignedUploaderIds(requesterId);
      const allIds = Array.from(new Set([requesterId, ...assignedUploaderIds]));
      const result = await this.invoiceRepo.findByUploaderIds(allIds, filters);
      return result.items;
    }

    if (requesterRole === UserRole.APPROVER) {
      const validatorIds =
        await this.assignmentRepo.getAssignedValidatorIds(requesterId);
      const uploaderIdArrays = await Promise.all(
        validatorIds.map((vId) =>
          this.assignmentRepo.getAssignedUploaderIds(vId),
        ),
      );
      const uploaderIds = uploaderIdArrays.flat();
      const allIds = Array.from(
        new Set([requesterId, ...validatorIds, ...uploaderIds]),
      );
      const result = await this.invoiceRepo.findByUploaderIds(allIds, filters);
      return result.items;
    }

    // Admin — all invoices
    const result = await this.invoiceRepo.findAll(filters);
    return result.items;
  }

  // ---------------------------------------------------------------------------
  // Serialisation helpers
  // ---------------------------------------------------------------------------

  private toJsonArray(invoices: Invoice[]): object[] {
    return invoices.map((inv) => ({
      invoiceId: inv.getId(),
      status: inv.getStatus().getValue(),
      uploaderId: inv.getUploaderId(),
      validatorId: inv.getValidatorId() ?? '',
      approverId: inv.getApproverId() ?? '',
      providerId: inv.getProviderId(),
      invoiceNumber: inv.getExtractedData()?.numeroFactura ?? '',
      vendorName: inv.getExtractedData()?.nombreEmisor ?? '',
      taxId: inv.getExtractedData()?.nifEmisor ?? '',
      amount: inv.getExtractedData()?.total ?? inv.getAmount().getValue(),
      baseAmount: inv.getExtractedData()?.baseImponible ?? '',
      vat: inv.getExtractedData()?.iva ?? '',
      invoiceDate: inv.getDate().getValue().toISOString().split('T')[0],
      createdAt: inv.getCreatedAt().toISOString(),
      rejectionReason: inv.getRejectionReason() ?? '',
    }));
  }

  private toCsv(invoices: Invoice[]): string {
    const headers = [
      'invoiceId',
      'status',
      'uploaderId',
      'validatorId',
      'approverId',
      'providerId',
      'invoiceNumber',
      'vendorName',
      'taxId',
      'amount',
      'baseAmount',
      'vat',
      'invoiceDate',
      'createdAt',
      'rejectionReason',
    ];

    const rows = this.toJsonArray(invoices).map((row) =>
      headers
        .map((h) => {
          const raw = (row as Record<string, unknown>)[h] ?? '';
          const val =
            raw === null || raw === undefined
              ? ''
              : typeof raw === 'object'
                ? JSON.stringify(raw)
                : String(raw as string | number | boolean | bigint | symbol);
          // Escape double-quotes per RFC 4180
          const escaped = val.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\r\n');
  }

  private async ensureExportsDirExists(): Promise<void> {
    if (!existsSync(this.exportsDir)) {
      await mkdir(this.exportsDir, { recursive: true });
    }
  }
}
