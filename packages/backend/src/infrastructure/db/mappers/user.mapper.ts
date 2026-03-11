import { User, UserRoleValue } from '../../../domain/entities/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';

export class UserMapper {
  /**
   * Converts a TypeORM ORM entity (from DB) into a domain User.
   * Uses reconstruct() — no validation, data is trusted from our own DB.
   */
  static toDomain(orm: UserOrmEntity): User {
    return User.reconstruct({
      id: orm.id,
      email: orm.email,
      role: orm.role as UserRoleValue,
      createdAt: orm.createdAt,
    });
  }

  /**
   * Converts a domain User into a TypeORM ORM entity ready to be saved.
   */
  static toOrm(domain: User): UserOrmEntity {
    const orm = new UserOrmEntity();
    orm.id = domain.getId();
    orm.email = domain.getEmail();
    orm.role = domain.getRole();
    orm.createdAt = domain.getCreatedAt();
    return orm;
  }
}
