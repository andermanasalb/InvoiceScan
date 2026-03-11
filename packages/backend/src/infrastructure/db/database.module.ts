import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

import {
  UserOrmEntity,
  UserCredentialOrmEntity,
  ProviderOrmEntity,
  InvoiceOrmEntity,
  InvoiceEventOrmEntity,
  AuditEventOrmEntity,
} from './entities';

import {
  InvoiceTypeOrmRepository,
  ProviderTypeOrmRepository,
  UserTypeOrmRepository,
  UserCredentialTypeOrmRepository,
  USER_CREDENTIAL_REPOSITORY,
  AuditEventTypeOrmRepository,
} from './repositories';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL,
        entities: [
          join(
            __dirname,
            '../../infrastructure/db/entities/*.orm-entity.{ts,js}',
          ),
        ],
        migrations: [
          join(__dirname, '../../infrastructure/db/migrations/*.{ts,js}'),
        ],
        synchronize: false,
        migrationsRun: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    // Registers ORM entities so repositories can inject them via @InjectRepository()
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserCredentialOrmEntity,
      ProviderOrmEntity,
      InvoiceOrmEntity,
      InvoiceEventOrmEntity,
      AuditEventOrmEntity,
    ]),
  ],
  providers: [
    // Bind domain interface tokens to their TypeORM implementations.
    // Use cases depend on the string token, never on the concrete class.
    { provide: 'InvoiceRepository', useClass: InvoiceTypeOrmRepository },
    { provide: 'ProviderRepository', useClass: ProviderTypeOrmRepository },
    { provide: 'UserRepository', useClass: UserTypeOrmRepository },
    { provide: USER_CREDENTIAL_REPOSITORY, useClass: UserCredentialTypeOrmRepository },
    { provide: 'AuditEventRepository', useClass: AuditEventTypeOrmRepository },
  ],
  exports: [
    'InvoiceRepository',
    'ProviderRepository',
    'UserRepository',
    USER_CREDENTIAL_REPOSITORY,
    'AuditEventRepository',
  ],
})
export class DatabaseModule {}
