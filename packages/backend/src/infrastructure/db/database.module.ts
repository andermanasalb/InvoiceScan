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
  OutboxEventOrmEntity,
  InvoiceNoteOrmEntity,
  UploaderValidatorAssignmentOrmEntity,
  ValidatorApproverAssignmentOrmEntity,
} from './entities';

import {
  InvoiceTypeOrmRepository,
  UserTypeOrmRepository,
  UserCredentialTypeOrmRepository,
  USER_CREDENTIAL_REPOSITORY,
  AuditEventTypeOrmRepository,
  OutboxEventTypeOrmRepository,
  InvoiceEventTypeOrmRepository,
  InvoiceNoteTypeOrmRepository,
} from './repositories';
import { AssignmentTypeOrmRepository } from './repositories/assignment.typeorm-repository';
import { ASSIGNMENT_REPOSITORY } from '../../domain/repositories/assignment.repository';

import { OUTBOX_EVENT_REPOSITORY } from '../../domain/repositories/outbox-event.repository.js';
import { INVOICE_EVENT_REPOSITORY } from '../../domain/repositories/invoice-event.repository.js';
import { INVOICE_NOTE_REPOSITORY } from '../../domain/repositories/invoice-note.repository.js';

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
      OutboxEventOrmEntity,
      InvoiceNoteOrmEntity,
      UploaderValidatorAssignmentOrmEntity,
      ValidatorApproverAssignmentOrmEntity,
    ]),
  ],
  providers: [
    // Bind domain interface tokens to their TypeORM implementations.
    // Use cases depend on the string token, never on the concrete class.
    { provide: 'InvoiceRepository', useClass: InvoiceTypeOrmRepository },
    { provide: 'UserRepository', useClass: UserTypeOrmRepository },
    {
      provide: USER_CREDENTIAL_REPOSITORY,
      useClass: UserCredentialTypeOrmRepository,
    },
    { provide: 'AuditEventRepository', useClass: AuditEventTypeOrmRepository },
    {
      provide: OUTBOX_EVENT_REPOSITORY,
      useClass: OutboxEventTypeOrmRepository,
    },
    {
      provide: INVOICE_EVENT_REPOSITORY,
      useClass: InvoiceEventTypeOrmRepository,
    },
    {
      provide: INVOICE_NOTE_REPOSITORY,
      useClass: InvoiceNoteTypeOrmRepository,
    },
    {
      provide: ASSIGNMENT_REPOSITORY,
      useClass: AssignmentTypeOrmRepository,
    },
  ],
  exports: [
    'InvoiceRepository',
    'UserRepository',
    USER_CREDENTIAL_REPOSITORY,
    'AuditEventRepository',
    OUTBOX_EVENT_REPOSITORY,
    INVOICE_EVENT_REPOSITORY,
    INVOICE_NOTE_REPOSITORY,
    ASSIGNMENT_REPOSITORY,
  ],
})
export class DatabaseModule {}
