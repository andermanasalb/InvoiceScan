import { Provider } from '../../../domain/entities/provider.entity';
import { ProviderName } from '../../../domain/value-objects';
import { ProviderOrmEntity } from '../entities/provider.orm-entity';

export class ProviderMapper {
  /**
   * Converts a TypeORM ORM entity (from DB) into a domain Provider.
   * Uses reconstruct() — no validation, data is trusted from our own DB.
   */
  static toDomain(orm: ProviderOrmEntity): Provider {
    const name = ProviderName.create(orm.name)._unsafeUnwrap();
    return Provider.reconstruct({
      id: orm.id,
      name,
      adapterType: orm.adapterType,
      createdAt: orm.createdAt,
    });
  }

  /**
   * Converts a domain Provider into a TypeORM ORM entity ready to be saved.
   */
  static toOrm(domain: Provider): ProviderOrmEntity {
    const orm = new ProviderOrmEntity();
    orm.id = domain.getId();
    orm.name = domain.getName().getValue();
    orm.adapterType = domain.getAdapterType();
    orm.createdAt = domain.getCreatedAt();
    return orm;
  }
}
