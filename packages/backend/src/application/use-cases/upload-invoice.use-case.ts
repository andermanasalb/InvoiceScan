/**
 * UploadInvoiceUseCase
 *
 * Caso de uso responsable de recibir un PDF de factura, persistirlo en storage,
 * crear la entidad Invoice en estado PENDING y encolar el job de procesamiento OCR.
 *
 * Flujo:
 *   1. Validar providerId (no vacío).
 *   2. Guardar el PDF en storage (genera UUID como nombre de archivo).
 *   3. Crear la entidad Invoice con amount y date provisionales.
 *   4. Persistir la factura en el repositorio.
 *   5. Encolar el job OCR en BullMQ (via InvoiceQueuePort).
 *   6. Registrar la acción en el audit log.
 *
 * Los valores de amount y date son placeholders que el worker de OCR
 * actualizará al completar la extracción (estado → EXTRACTED).
 */
import { ok, err, Result } from 'neverthrow';
import { randomUUID } from 'crypto';
import { InvoiceRepository } from '../../domain/repositories';
import { AssignmentRepository } from '../../domain/repositories/assignment.repository';
import { StoragePort, AuditPort, InvoiceQueuePort } from '../ports';
import { UploadInvoiceInput, UploadInvoiceOutput } from '../dtos';
import { Invoice } from '../../domain/entities';
import { InvoiceAmount, InvoiceDate } from '../../domain/value-objects';
import { DomainError } from '../../domain/errors/domain.error';
import { InvalidFieldError, NotAssignedError } from '../../domain/errors';

export class UploadInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly storage: StoragePort,
    private readonly auditor: AuditPort,
    private readonly queue: InvoiceQueuePort,
    private readonly assignmentRepo: AssignmentRepository,
  ) {}

  async execute(
    input: UploadInvoiceInput,
  ): Promise<Result<UploadInvoiceOutput, DomainError>> {
    if (!input.providerId || input.providerId.trim().length === 0) {
      return err(
        new InvalidFieldError('providerId', 'Provider ID cannot be empty'),
      );
    }

    // Assignment check: uploaders must have a full chain (validator + approver).
    // Admins are exempt — they can always upload.
    if (input.uploaderRole === 'uploader') {
      const validatorId =
        await this.assignmentRepo.getAssignedValidatorForUploader(
          input.uploaderId,
        );
      if (!validatorId) {
        return err(
          new NotAssignedError(
            'You are not assigned to a validator. Ask an admin to assign you before uploading.',
          ),
        );
      }
      const approverId =
        await this.assignmentRepo.getAssignedApproverForValidator(validatorId);
      if (!approverId) {
        return err(
          new NotAssignedError(
            'Your assigned validator has no approver. Ask an admin to complete the assignment chain.',
          ),
        );
      }
    }

    // Placeholder: amount y date se actualizan tras el OCR (worker process-invoice)
    const amount = InvoiceAmount.createPlaceholder();

    const dateResult = InvoiceDate.create(new Date());
    if (dateResult.isErr()) return err(dateResult.error);

    const stored = await this.storage.save(input.fileBuffer, input.mimeType);

    const invoiceResult = Invoice.create({
      id: randomUUID(),
      providerId: input.providerId,
      uploaderId: input.uploaderId,
      filePath: stored.key,
      amount: amount,
      date: dateResult.value,
      createdAt: new Date(),
    });

    if (invoiceResult.isErr()) return err(invoiceResult.error);
    const invoice = invoiceResult.value;

    await this.invoiceRepo.save(invoice);

    // Encola el job de OCR — el worker procesará la factura en background
    await this.queue.enqueueProcessing(invoice.getId());

    await this.auditor.record({
      action: 'upload',
      resourceId: invoice.getId(),
      userId: input.uploaderId,
    });

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      filePath: invoice.getFilePath(),
      uploaderId: invoice.getUploaderId(),
      providerId: invoice.getProviderId(),
      createdAt: invoice.getCreatedAt(),
    });
  }
}
