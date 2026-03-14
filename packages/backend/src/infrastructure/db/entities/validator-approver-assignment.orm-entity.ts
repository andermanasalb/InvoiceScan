import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('validator_approver_assignments')
@Unique(['validatorId'])
export class ValidatorApproverAssignmentOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'validator_id', type: 'uuid' })
  validatorId: string;

  @Column({ name: 'approver_id', type: 'uuid' })
  approverId: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
