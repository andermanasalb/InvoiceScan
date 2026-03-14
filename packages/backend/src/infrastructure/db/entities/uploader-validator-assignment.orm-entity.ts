import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('uploader_validator_assignments')
@Unique(['uploaderId'])
export class UploaderValidatorAssignmentOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'uploader_id', type: 'uuid' })
  uploaderId: string;

  @Column({ name: 'validator_id', type: 'uuid' })
  validatorId: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
