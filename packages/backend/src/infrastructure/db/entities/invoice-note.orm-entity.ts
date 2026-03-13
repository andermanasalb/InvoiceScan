import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('invoice_notes')
export class InvoiceNoteOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
