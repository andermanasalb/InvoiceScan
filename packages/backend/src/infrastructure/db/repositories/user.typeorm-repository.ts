import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../domain/entities';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class UserTypeOrmRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const orm = await this.repo.findOneBy({ id });
    if (!orm) return null;
    return UserMapper.toDomain(orm);
  }

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.repo.findOneBy({ email });
    if (!orm) return null;
    return UserMapper.toDomain(orm);
  }

  async findAll(): Promise<User[]> {
    const orms = await this.repo.find({ order: { createdAt: 'ASC' } });
    return orms.map((orm) => UserMapper.toDomain(orm));
  }

  async save(user: User): Promise<void> {
    const orm = UserMapper.toOrm(user);
    await this.repo.save(orm);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
