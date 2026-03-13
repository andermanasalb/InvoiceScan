import { Invoice, ExtractedData } from '../../../domain/entities/invoice.entity';
import {
  InvoiceAmount,
  InvoiceDate,
  InvoiceStatus,
  InvoiceStatusEnum,
} from '../../../domain/value-objects';
import { InvoiceOrmEntity } from '../entities/invoice.orm-entity';

export class InvoiceMapper {
  /**
   * Converts a TypeORM ORM entity (from DB) into a domain Invoice.
   * Uses reconstruct() — no validation, data is trusted from our own DB.
   */
  static toDomain(orm: InvoiceOrmEntity): Invoice {
    // Reconstruct Value Objects from raw DB primitives
    const amount =
      Number(orm.amount) === 0
        ? InvoiceAmount.createPlaceholder()
        : InvoiceAmount.create(Number(orm.amount))._unsafeUnwrap();

    const date = InvoiceDate.create(new Date(orm.date))._unsafeUnwrap();

    const status = InvoiceStatus.create(
      orm.status as (typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum],
    )._unsafeUnwrap();

    const raw = orm.extractedData as Record<string, unknown> | null;
    const extractedData: ExtractedData | null = raw
      ? {
          rawText: (raw['rawText'] as string) ?? '',
          total: (raw['total'] as number | null) ?? null,
          fecha: (raw['fecha'] as string | null) ?? null,
          numeroFactura: (raw['numeroFactura'] as string | null) ?? null,
          nifEmisor: (raw['nifEmisor'] as string | null) ?? null,
          nombreEmisor: (raw['nombreEmisor'] as string | null) ?? null,
          baseImponible: (raw['baseImponible'] as number | null) ?? null,
          iva: (raw['iva'] as number | null) ?? null,
        }
      : null;

    return Invoice.reconstruct({
      id: orm.id,
      providerId: orm.providerId,
      uploaderId: orm.uploaderId,
      filePath: orm.filePath,
      amount,
      date,
      createdAt: orm.createdAt,
      status,
      extractedData,
      validationErrors: orm.validationErrors ?? [],
      validatorId: orm.validatorId,
      approverId: orm.approverId,
      rejectionReason: orm.rejectionReason,
    });
  }

  /**
   * Converts a domain Invoice into a TypeORM ORM entity ready to be saved.
   */
  static toOrm(domain: Invoice): InvoiceOrmEntity {
    const orm = new InvoiceOrmEntity();
    orm.id = domain.getId();
    orm.providerId = domain.getProviderId();
    orm.uploaderId = domain.getUploaderId();
    orm.filePath = domain.getFilePath();
    orm.amount = domain.getAmount().getValue();
    orm.date = domain.getDate().getValue();
    orm.status = domain.getStatus().getValue();
    orm.extractedData =
      domain.getExtractedData() as Record<string, unknown> | null;
    orm.validationErrors = domain.getValidationErrors();
    orm.validatorId = domain.getValidatorId();
    orm.approverId = domain.getApproverId();
    orm.rejectionReason = domain.getRejectionReason();
    orm.createdAt = domain.getCreatedAt();
    return orm;
  }
}
