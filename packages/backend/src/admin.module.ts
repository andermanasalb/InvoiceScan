import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/db/database.module';
import { AuthModule } from './interface/auth.module';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { AssignUploaderUseCase } from './application/use-cases/assign-uploader.use-case';
import { AssignValidatorUseCase } from './application/use-cases/assign-validator.use-case';
import { RemoveAssignmentUseCase } from './application/use-cases/remove-assignment.use-case';
import { GetAssignmentTreeUseCase } from './application/use-cases/get-assignment-tree.use-case';
import {
  AdminController,
  ADMIN_CREATE_USER_TOKEN,
  ADMIN_LIST_USERS_TOKEN,
  ADMIN_ASSIGN_UPLOADER_TOKEN,
  ADMIN_ASSIGN_VALIDATOR_TOKEN,
  ADMIN_REMOVE_ASSIGNMENT_TOKEN,
  ADMIN_GET_TREE_TOKEN,
} from './interface/http/controllers/admin.controller';
import { ASSIGNMENT_REPOSITORY } from './domain/repositories/assignment.repository';
import { USER_CREDENTIAL_REPOSITORY } from './infrastructure/db/repositories';

import type { UserRepository } from './domain/repositories';
import type { UserCredentialRepository } from './domain/repositories/user-credential.repository';
import type { AssignmentRepository } from './domain/repositories/assignment.repository';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController],
  providers: [
    {
      provide: ADMIN_CREATE_USER_TOKEN,
      useFactory: (
        userRepo: UserRepository,
        credentialRepo: UserCredentialRepository,
      ) => new CreateUserUseCase(userRepo, credentialRepo),
      inject: ['UserRepository', USER_CREDENTIAL_REPOSITORY],
    },
    {
      provide: ADMIN_LIST_USERS_TOKEN,
      useFactory: (userRepo: UserRepository) => new ListUsersUseCase(userRepo),
      inject: ['UserRepository'],
    },
    {
      provide: ADMIN_ASSIGN_UPLOADER_TOKEN,
      useFactory: (
        assignmentRepo: AssignmentRepository,
        userRepo: UserRepository,
      ) => new AssignUploaderUseCase(assignmentRepo, userRepo),
      inject: [ASSIGNMENT_REPOSITORY, 'UserRepository'],
    },
    {
      provide: ADMIN_ASSIGN_VALIDATOR_TOKEN,
      useFactory: (
        assignmentRepo: AssignmentRepository,
        userRepo: UserRepository,
      ) => new AssignValidatorUseCase(assignmentRepo, userRepo),
      inject: [ASSIGNMENT_REPOSITORY, 'UserRepository'],
    },
    {
      provide: ADMIN_REMOVE_ASSIGNMENT_TOKEN,
      useFactory: (assignmentRepo: AssignmentRepository) =>
        new RemoveAssignmentUseCase(assignmentRepo),
      inject: [ASSIGNMENT_REPOSITORY],
    },
    {
      provide: ADMIN_GET_TREE_TOKEN,
      useFactory: (assignmentRepo: AssignmentRepository) =>
        new GetAssignmentTreeUseCase(assignmentRepo),
      inject: [ASSIGNMENT_REPOSITORY],
    },
  ],
})
export class AdminModule {}
