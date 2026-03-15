import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/db/database.module';
import {
  AuthModule,
  CREATE_USER_USE_CASE_TOKEN,
} from './interface/auth.module';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { AssignUploaderUseCase } from './application/use-cases/assign-uploader.use-case';
import { AssignValidatorUseCase } from './application/use-cases/assign-validator.use-case';
import { RemoveAssignmentUseCase } from './application/use-cases/remove-assignment.use-case';
import { GetAssignmentTreeUseCase } from './application/use-cases/get-assignment-tree.use-case';
import {
  AdminController,
  ADMIN_LIST_USERS_TOKEN,
  ADMIN_ASSIGN_UPLOADER_TOKEN,
  ADMIN_ASSIGN_VALIDATOR_TOKEN,
  ADMIN_REMOVE_ASSIGNMENT_TOKEN,
  ADMIN_GET_TREE_TOKEN,
} from './interface/http/controllers/admin.controller';
import { ASSIGNMENT_REPOSITORY } from './domain/repositories/assignment.repository';

import type { UserRepository } from './domain/repositories';
import type { AssignmentRepository } from './domain/repositories/assignment.repository';

/**
 * AdminModule
 *
 * Handles user management and assignment hierarchy endpoints.
 *
 * CreateUserUseCase comes directly from AuthModule (which already exports
 * CREATE_USER_USE_CASE_TOKEN) — no need to re-instantiate it here.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminController],
  providers: [
    // Re-export AuthModule's CreateUserUseCase under the same token.
    // AdminController injects CREATE_USER_USE_CASE_TOKEN directly.
    {
      provide: CREATE_USER_USE_CASE_TOKEN,
      useExisting: CREATE_USER_USE_CASE_TOKEN,
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
