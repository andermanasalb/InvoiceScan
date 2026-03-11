import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('providers')
export class ProviderOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'adapter_type', type: 'varchar', length: 100 })
  adapterType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
