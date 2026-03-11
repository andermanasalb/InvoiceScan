import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProviderOrmEntity } from './provider.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

@Entity('invoices')
export class InvoiceOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @Column({ name: 'uploader_id', type: 'uuid' })
  uploaderId: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ name: 'extracted_data', type: 'jsonb', nullable: true })
  extractedData: Record<string, unknown> | null;

  @Column({ name: 'validation_errors', type: 'text', array: true, default: [] })
  validationErrors: string[];

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ProviderOrmEntity)
  @JoinColumn({ name: 'provider_id' })
  provider: ProviderOrmEntity;

  @ManyToOne(() => UserOrmEntity)
  @JoinColumn({ name: 'uploader_id' })
  uploader: UserOrmEntity;
}
