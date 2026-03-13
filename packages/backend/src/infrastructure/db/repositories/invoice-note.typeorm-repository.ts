import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceNoteOrmEntity } from '../entities/invoice-note.orm-entity';
import {
  InvoiceNote,
  InvoiceNoteRepository,
} from '../../../domain/repositories/invoice-note.repository';

@Injectable()
export class InvoiceNoteTypeOrmRepository implements InvoiceNoteRepository {
  constructor(
    @InjectRepository(InvoiceNoteOrmEntity)
    private readonly repo: Repository<InvoiceNoteOrmEntity>,
  ) {}

  async save(note: InvoiceNote): Promise<void> {
    await this.repo.save({
      id: note.id,
      invoiceId: note.invoiceId,
      authorId: note.authorId,
      content: note.content,
      createdAt: note.createdAt,
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<InvoiceNote[]> {
    const orms = await this.repo.find({
      where: { invoiceId },
      order: { createdAt: 'ASC' },
    });
    return orms.map((o) => ({
      id: o.id,
      invoiceId: o.invoiceId,
      authorId: o.authorId,
      content: o.content,
      createdAt: o.createdAt,
    }));
  }
}
