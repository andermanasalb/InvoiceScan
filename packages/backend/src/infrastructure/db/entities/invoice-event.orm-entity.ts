import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvoiceOrmEntity } from './invoice.orm-entity';

@Entity('invoice_events')
export class InvoiceEventOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'from_status', type: 'varchar', length: 50 })
  fromStatus: string;

  @Column({ name: 'to_status', type: 'varchar', length: 50 })
  toStatus: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @ManyToOne(() => InvoiceOrmEntity)
  @JoinColumn({ name: 'invoice_id' })
  invoice: InvoiceOrmEntity;
}
