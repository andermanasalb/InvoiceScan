/**
 * InvoiceTypeOrmRepository
 *
 * Implementación TypeORM del contrato InvoiceRepository definido en el dominio.
 * Traduce operaciones de dominio (save, findById, findAll…) a queries SQL
 * mediante el QueryBuilder de TypeORM y delega la conversión ORM ↔ dominio
 * al InvoiceMapper.
 *
 * Reglas de seguridad:
 * - Los campos de ordenación se validan contra ALLOWED_SORT_FIELDS para
 *   prevenir inyección SQL por columna (TypeORM no parametriza nombres de columna).
 * - Los filtros de estado y uploaderId se pasan como parámetros tipados (:param),
 *   nunca interpolados directamente en la query.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../../../domain/entities';
import {
  InvoiceRepository,
  InvoiceFilters,
  PaginatedResult,
} from '../../../domain/repositories/invoice.repository';
import { InvoiceOrmEntity } from '../entities/invoice.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { InvoiceMapper } from '../mappers/invoice.mapper';

/**
 * Campos de ordenación permitidos en queries de listado.
 * Cualquier valor fuera de este conjunto se redirige a 'createdAt' por defecto.
 * Esto previene SQL injection por interpolación de nombre de columna.
 */
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'amount', 'status', 'date']);

@Injectable()
export class InvoiceTypeOrmRepository implements InvoiceRepository {
  constructor(
    @InjectRepository(InvoiceOrmEntity)
    private readonly repo: Repository<InvoiceOrmEntity>,
  ) {}

  async findById(id: string): Promise<Invoice | null> {
    const orm = await this.repo.findOneBy({ id });
    if (!orm) return null;
    return InvoiceMapper.toDomain(orm);
  }

  async findUploaderEmail(uploaderId: string): Promise<string | null> {
    const result = await this.repo.manager
      .getRepository(UserOrmEntity)
      .findOne({ where: { id: uploaderId }, select: ['email'] });
    return result?.email ?? null;
  }

  async findAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('invoice');

    if (filters.status) {
      qb.andWhere('invoice.status = :status', { status: filters.status });
    }

    const [rawField, sortOrder] = (filters.sort ?? 'createdAt:desc').split(':');
    const safeField = ALLOWED_SORT_FIELDS.has(rawField) ? rawField : 'createdAt';
    const order = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`invoice.${safeField}`, order);

    qb.skip(skip).take(limit);

    const [orms, total] = await qb.getManyAndCount();
    return { items: orms.map((orm) => InvoiceMapper.toDomain(orm)), total };
  }

  async findByUploaderId(
    uploaderId: string,
    filters: InvoiceFilters,
  ): Promise<PaginatedResult<Invoice>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('invoice')
      .where('invoice.uploaderId = :uploaderId', { uploaderId });

    if (filters.status) {
      qb.andWhere('invoice.status = :status', { status: filters.status });
    }

    const [rawField2, sortOrder2] = (filters.sort ?? 'createdAt:desc').split(':');
    const safeField2 = ALLOWED_SORT_FIELDS.has(rawField2) ? rawField2 : 'createdAt';
    const order2 = sortOrder2?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`invoice.${safeField2}`, order2);

    qb.skip(skip).take(limit);

    const [orms, total] = await qb.getManyAndCount();
    return { items: orms.map((orm) => InvoiceMapper.toDomain(orm)), total };
  }

  async save(invoice: Invoice): Promise<void> {
    const orm = InvoiceMapper.toOrm(invoice);
    await this.repo.save(orm);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * Devuelve el conteo de todas las facturas agrupado por estado.
   * Una única query SQL con GROUP BY — reemplaza las N llamadas paralelas
   * del dashboard que antes hacían un SELECT por cada estado.
   */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('invoice')
      .select('invoice.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('invoice.status')
      .getRawMany<{ status: string; count: string }>();

    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  }

  /**
   * Igual que countByStatus pero filtrado por uploaderId.
   * Usado cuando el solicitante tiene rol 'uploader' y solo puede ver sus propias facturas.
   */
  async countByStatusForUploader(
    uploaderId: string,
  ): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('invoice')
      .select('invoice.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('invoice.uploaderId = :uploaderId', { uploaderId })
      .groupBy('invoice.status')
      .getRawMany<{ status: string; count: string }>();

    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  }
}
