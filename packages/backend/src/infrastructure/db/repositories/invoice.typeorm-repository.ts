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

    const [sortField, sortOrder] = (filters.sort ?? 'createdAt:desc').split(':');
    const order = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`invoice.${sortField}`, order);

    qb.skip(skip).take(limit);

    const [orms, total] = await qb.getManyAndCount();
    return { items: orms.map(InvoiceMapper.toDomain), total };
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

    const [sortField, sortOrder] = (filters.sort ?? 'createdAt:desc').split(':');
    const order = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`invoice.${sortField}`, order);

    qb.skip(skip).take(limit);

    const [orms, total] = await qb.getManyAndCount();
    return { items: orms.map(InvoiceMapper.toDomain), total };
  }

  async save(invoice: Invoice): Promise<void> {
    const orm = InvoiceMapper.toOrm(invoice);
    await this.repo.save(orm);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
