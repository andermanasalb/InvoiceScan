import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserCredential,
  UserCredentialRepository,
} from '../../../domain/repositories/user-credential.repository';
import { UserCredentialOrmEntity } from '../entities/user-credential.orm-entity';

export const USER_CREDENTIAL_REPOSITORY = 'UserCredentialRepository';

@Injectable()
export class UserCredentialTypeOrmRepository implements UserCredentialRepository {
  constructor(
    @InjectRepository(UserCredentialOrmEntity)
    private readonly repo: Repository<UserCredentialOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<UserCredential | null> {
    const orm = await this.repo.findOneBy({ userId });
    if (!orm) return null;
    return {
      id: orm.id,
      userId: orm.userId,
      passwordHash: orm.passwordHash,
      createdAt: orm.createdAt,
    };
  }

  async save(credential: UserCredential): Promise<void> {
    const orm = new UserCredentialOrmEntity();
    orm.id = credential.id;
    orm.userId = credential.userId;
    orm.passwordHash = credential.passwordHash;
    orm.createdAt = credential.createdAt;
    await this.repo.save(orm);
  }
}
