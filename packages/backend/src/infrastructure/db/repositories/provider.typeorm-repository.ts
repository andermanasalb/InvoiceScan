import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from '../../../domain/entities';
import { ProviderRepository } from '../../../domain/repositories/provider.repository';
import { ProviderOrmEntity } from '../entities/provider.orm-entity';
import { ProviderMapper } from '../mappers/provider.mapper';

@Injectable()
export class ProviderTypeOrmRepository implements ProviderRepository {
  constructor(
    @InjectRepository(ProviderOrmEntity)
    private readonly repo: Repository<ProviderOrmEntity>,
  ) {}

  async findById(id: string): Promise<Provider | null> {
    const orm = await this.repo.findOneBy({ id });
    if (!orm) return null;
    return ProviderMapper.toDomain(orm);
  }

  async findByName(name: string): Promise<Provider | null> {
    const orm = await this.repo.findOneBy({ name });
    if (!orm) return null;
    return ProviderMapper.toDomain(orm);
  }

  async findAll(): Promise<Provider[]> {
    const orms = await this.repo.find({ order: { name: 'ASC' } });
    return orms.map(ProviderMapper.toDomain);
  }

  async save(provider: Provider): Promise<void> {
    const orm = ProviderMapper.toOrm(provider);
    await this.repo.save(orm);
  }
}
