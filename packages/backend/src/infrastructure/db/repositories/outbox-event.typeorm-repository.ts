import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { OutboxEventOrmEntity } from '../entities/outbox-event.orm-entity.js';
import {
  OutboxEventRepository,
  OutboxEventRecord,
} from '../../../domain/repositories/outbox-event.repository.js';
import { DomainEventBase } from '../../../domain/events/domain-event.base.js';

@Injectable()
export class OutboxEventTypeOrmRepository implements OutboxEventRepository {
  constructor(
    @InjectRepository(OutboxEventOrmEntity)
    private readonly repo: Repository<OutboxEventOrmEntity>,
  ) {}

  /**
   * Returns a new instance scoped to the provided EntityManager.
   * Used by TypeOrmUnitOfWork to share a single database transaction.
   */
  forManager(em: EntityManager): OutboxEventTypeOrmRepository {
    return new OutboxEventTypeOrmRepository(
      em.getRepository(OutboxEventOrmEntity),
    );
  }

  async save(event: DomainEventBase): Promise<void> {
    const record = this.repo.create({
      id: randomUUID(),
      eventType: event.eventType,
      payload: event.payload,
      processed: false,
      processedAt: null,
    });
    await this.repo.save(record);
  }

  async findUnprocessed(): Promise<OutboxEventRecord[]> {
    const rows = await this.repo.find({
      where: { processed: false },
      order: { createdAt: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      payload: row.payload,
      processed: row.processed,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
    }));
  }

  async markProcessed(id: string): Promise<void> {
    await this.repo.update(id, {
      processed: true,
      processedAt: new Date(),
    });
  }
}
