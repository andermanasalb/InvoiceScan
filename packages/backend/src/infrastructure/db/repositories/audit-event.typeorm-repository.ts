import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from '../../../domain/entities';
import {
  AuditEventRepository,
  AuditEventFilters,
} from '../../../domain/repositories/audit-event.repository';
import { AuditEventOrmEntity } from '../entities/audit-event.orm-entity';
import { AuditEventMapper } from '../mappers/audit-event.mapper';

@Injectable()
export class AuditEventTypeOrmRepository implements AuditEventRepository {
  constructor(
    @InjectRepository(AuditEventOrmEntity)
    private readonly repo: Repository<AuditEventOrmEntity>,
  ) {}

  async findById(id: string): Promise<AuditEvent | null> {
    const orm = await this.repo.findOneBy({ id });
    if (!orm) return null;
    return AuditEventMapper.toDomain(orm);
  }

  async findAll(filters: AuditEventFilters): Promise<AuditEvent[]> {
    const qb = this.repo.createQueryBuilder('audit');

    if (filters.userId) {
      qb.andWhere('audit.userId = :userId', { userId: filters.userId });
    }
    if (filters.resourceId) {
      qb.andWhere('audit.resourceId = :resourceId', {
        resourceId: filters.resourceId,
      });
    }
    if (filters.action) {
      qb.andWhere('audit.action = :action', { action: filters.action });
    }
    if (filters.from) {
      qb.andWhere('audit.timestamp >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('audit.timestamp <= :to', { to: filters.to });
    }

    qb.orderBy('audit.timestamp', 'DESC');

    const orms = await qb.getMany();
    return orms.map((orm) => AuditEventMapper.toDomain(orm));
  }

  async save(event: AuditEvent): Promise<void> {
    const orm = AuditEventMapper.toOrm(event);
    await this.repo.save(orm);
  }
}
