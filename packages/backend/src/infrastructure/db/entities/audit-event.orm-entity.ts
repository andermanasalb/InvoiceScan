import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('audit_events')
export class AuditEventOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ type: 'varchar', length: 45 })
  ip: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}
