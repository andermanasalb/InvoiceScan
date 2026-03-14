import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { AssignmentRepository } from '../../../domain/repositories/assignment.repository';
import type {
  UploaderValidatorAssignment,
  ValidatorApproverAssignment,
  AssignmentTree,
  ApproverNode,
  ValidatorNode,
  UserNode,
} from '../../../domain/entities/assignment.entity';
import { UploaderValidatorAssignmentOrmEntity } from '../entities/uploader-validator-assignment.orm-entity';
import { ValidatorApproverAssignmentOrmEntity } from '../entities/validator-approver-assignment.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';

@Injectable()
export class AssignmentTypeOrmRepository implements AssignmentRepository {
  constructor(
    @InjectRepository(UploaderValidatorAssignmentOrmEntity)
    private readonly uvaRepo: Repository<UploaderValidatorAssignmentOrmEntity>,
    @InjectRepository(ValidatorApproverAssignmentOrmEntity)
    private readonly vaaRepo: Repository<ValidatorApproverAssignmentOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
  ) {}

  async assignUploaderToValidator(
    uploaderId: string,
    validatorId: string,
    createdBy: string,
  ): Promise<UploaderValidatorAssignment> {
    // Upsert: delete existing assignment first if present
    await this.uvaRepo.delete({ uploaderId });

    const entity = this.uvaRepo.create({
      id: randomUUID(),
      uploaderId,
      validatorId,
      createdBy,
    });
    const saved = await this.uvaRepo.save(entity);
    return saved as UploaderValidatorAssignment;
  }

  async assignValidatorToApprover(
    validatorId: string,
    approverId: string,
    createdBy: string,
  ): Promise<ValidatorApproverAssignment> {
    // Upsert: delete existing assignment first if present
    await this.vaaRepo.delete({ validatorId });

    const entity = this.vaaRepo.create({
      id: randomUUID(),
      validatorId,
      approverId,
      createdBy,
    });
    const saved = await this.vaaRepo.save(entity);
    return saved as ValidatorApproverAssignment;
  }

  async removeUploaderAssignment(uploaderId: string): Promise<void> {
    await this.uvaRepo.delete({ uploaderId });
  }

  async removeValidatorAssignment(validatorId: string): Promise<void> {
    await this.vaaRepo.delete({ validatorId });
  }

  async getAssignedUploaderIds(validatorId: string): Promise<string[]> {
    const rows = await this.uvaRepo.find({
      where: { validatorId },
      select: ['uploaderId'],
    });
    return rows.map((r) => r.uploaderId);
  }

  async getAssignedValidatorIds(approverId: string): Promise<string[]> {
    const rows = await this.vaaRepo.find({
      where: { approverId },
      select: ['validatorId'],
    });
    return rows.map((r) => r.validatorId);
  }

  async getAssignedValidatorForUploader(
    uploaderId: string,
  ): Promise<string | null> {
    const row = await this.uvaRepo.findOne({
      where: { uploaderId },
      select: ['validatorId'],
    });
    return row?.validatorId ?? null;
  }

  async getAssignedApproverForValidator(
    validatorId: string,
  ): Promise<string | null> {
    const row = await this.vaaRepo.findOne({
      where: { validatorId },
      select: ['approverId'],
    });
    return row?.approverId ?? null;
  }

  async getFullTree(): Promise<AssignmentTree> {
    // Load all users, all UVA assignments, all VAA assignments in 3 queries
    const [allUsers, uvaRows, vaaRows] = await Promise.all([
      this.userRepo.find({ select: ['id', 'email', 'role'] }),
      this.uvaRepo.find(),
      this.vaaRepo.find(),
    ]);

    const userMap = new Map(
      allUsers.map((u) => [
        u.id,
        { userId: u.id, email: u.email, role: u.role } satisfies UserNode,
      ]),
    );

    // Index: validatorId → uploader UserNodes
    const validatorUploaders = new Map<string, UserNode[]>();
    const assignedUploaderIds = new Set<string>();
    for (const uva of uvaRows) {
      const uploaderNode = userMap.get(uva.uploaderId);
      if (!uploaderNode) continue;
      const list = validatorUploaders.get(uva.validatorId) ?? [];
      list.push(uploaderNode);
      validatorUploaders.set(uva.validatorId, list);
      assignedUploaderIds.add(uva.uploaderId);
    }

    // Index: approverId → validator ValidatorNodes
    const approverValidators = new Map<string, ValidatorNode[]>();
    const assignedValidatorIds = new Set<string>();
    for (const vaa of vaaRows) {
      const validatorUser = userMap.get(vaa.validatorId);
      if (!validatorUser) continue;
      const validatorNode: ValidatorNode = {
        ...validatorUser,
        uploaders: validatorUploaders.get(vaa.validatorId) ?? [],
      };
      const list = approverValidators.get(vaa.approverId) ?? [];
      list.push(validatorNode);
      approverValidators.set(vaa.approverId, list);
      assignedValidatorIds.add(vaa.validatorId);
    }

    // Build approver nodes
    const approvers: ApproverNode[] = [];
    const assignedApproverIds = new Set<string>();
    for (const user of allUsers) {
      if (user.role !== 'approver') continue;
      const validators = approverValidators.get(user.id) ?? [];
      if (validators.length > 0) {
        approvers.push({
          userId: user.id,
          email: user.email,
          role: user.role,
          validators,
        });
        assignedApproverIds.add(user.id);
      }
    }
    // Also include approvers with no validators yet
    for (const user of allUsers) {
      if (user.role !== 'approver' || assignedApproverIds.has(user.id))
        continue;
      approvers.push({
        userId: user.id,
        email: user.email,
        role: user.role,
        validators: [],
      });
    }

    const unassignedUploaders = allUsers
      .filter((u) => u.role === 'uploader' && !assignedUploaderIds.has(u.id))
      .map((u) => ({ userId: u.id, email: u.email, role: u.role }));

    const unassignedValidators = allUsers
      .filter((u) => u.role === 'validator' && !assignedValidatorIds.has(u.id))
      .map((u) => ({ userId: u.id, email: u.email, role: u.role }));

    const unassignedApprovers = allUsers
      .filter((u) => u.role === 'approver')
      .filter((u) => (approverValidators.get(u.id) ?? []).length === 0)
      .map((u) => ({ userId: u.id, email: u.email, role: u.role }));

    return {
      unassignedUploaders,
      unassignedValidators,
      unassignedApprovers,
      approvers,
    };
  }
}
