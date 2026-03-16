/* eslint-disable @typescript-eslint/only-throw-error */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../guards/roles.decorator';
import { CurrentUser } from '../guards/current-user.decorator';
import type { AuthenticatedUser } from '../guards/jwt.strategy';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
// CREATE_USER_USE_CASE_TOKEN comes from AuthModule (already exported there).
// AdminModule re-uses it via useExisting — no duplicate instantiation.
import { CREATE_USER_USE_CASE_TOKEN } from '../../auth.module';
import type { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case';
import type { ListUsersUseCase } from '../../../application/use-cases/list-users.use-case';
import type { AssignUploaderUseCase } from '../../../application/use-cases/assign-uploader.use-case';
import type { AssignValidatorUseCase } from '../../../application/use-cases/assign-validator.use-case';
import type { RemoveAssignmentUseCase } from '../../../application/use-cases/remove-assignment.use-case';
import type { GetAssignmentTreeUseCase } from '../../../application/use-cases/get-assignment-tree.use-case';
import type { DeleteUserUseCase } from '../../../application/use-cases/delete-user.use-case';

// ── Injection tokens ──────────────────────────────────────────────────────────
// CREATE_USER_USE_CASE_TOKEN is re-exported from auth.module — imported above.
export { CREATE_USER_USE_CASE_TOKEN };
export const ADMIN_LIST_USERS_TOKEN = 'ADMIN_LIST_USERS_USE_CASE';
export const ADMIN_ASSIGN_UPLOADER_TOKEN = 'ADMIN_ASSIGN_UPLOADER_USE_CASE';
export const ADMIN_ASSIGN_VALIDATOR_TOKEN = 'ADMIN_ASSIGN_VALIDATOR_USE_CASE';
export const ADMIN_REMOVE_ASSIGNMENT_TOKEN = 'ADMIN_REMOVE_ASSIGNMENT_USE_CASE';
export const ADMIN_GET_TREE_TOKEN = 'ADMIN_GET_TREE_USE_CASE';
export const ADMIN_DELETE_USER_TOKEN = 'ADMIN_DELETE_USER_USE_CASE';

// ── Request body schemas ──────────────────────────────────────────────────────
const CreateUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['uploader', 'validator', 'approver', 'admin']),
});
type CreateUserBody = z.infer<typeof CreateUserBodySchema>;

const AssignUploaderBodySchema = z.object({
  uploaderId: z.string().uuid(),
  validatorId: z.string().uuid(),
});
type AssignUploaderBody = z.infer<typeof AssignUploaderBodySchema>;

const AssignValidatorBodySchema = z.object({
  validatorId: z.string().uuid(),
  approverId: z.string().uuid(),
});
type AssignValidatorBody = z.infer<typeof AssignValidatorBodySchema>;

const ListUsersQuerySchema = z.object({
  role: z.enum(['uploader', 'validator', 'approver', 'admin']).optional(),
});
type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

/**
 * AdminController
 *
 * All endpoints are restricted to the 'admin' role.
 * Handles: user creation, user listing, assignment management, tree retrieval.
 */
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    @Inject(CREATE_USER_USE_CASE_TOKEN)
    private readonly createUserUseCase: CreateUserUseCase,
    @Inject(ADMIN_LIST_USERS_TOKEN)
    private readonly listUsersUseCase: ListUsersUseCase,
    @Inject(ADMIN_ASSIGN_UPLOADER_TOKEN)
    private readonly assignUploaderUseCase: AssignUploaderUseCase,
    @Inject(ADMIN_ASSIGN_VALIDATOR_TOKEN)
    private readonly assignValidatorUseCase: AssignValidatorUseCase,
    @Inject(ADMIN_REMOVE_ASSIGNMENT_TOKEN)
    private readonly removeAssignmentUseCase: RemoveAssignmentUseCase,
    @Inject(ADMIN_GET_TREE_TOKEN)
    private readonly getAssignmentTreeUseCase: GetAssignmentTreeUseCase,
    @Inject(ADMIN_DELETE_USER_TOKEN)
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  /**
   * POST /api/v1/admin/users
   * Create a new user with any role.
   */
  @Post('users')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body(new ZodValidationPipe(CreateUserBodySchema)) body: CreateUserBody,
  ) {
    const result = await this.createUserUseCase.execute(body);
    if (result.isErr()) throw result.error;
    return { data: result.value };
  }

  /**
   * GET /api/v1/admin/users?role=uploader|validator|approver|admin
   * List all users, optionally filtered by role.
   */
  @Get('users')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async listUsers(
    @Query(new ZodValidationPipe(ListUsersQuerySchema)) query: ListUsersQuery,
  ) {
    const result = await this.listUsersUseCase.execute({ role: query.role });
    if (result.isErr()) throw result.error;
    return { data: result.value.users };
  }

  /**
   * POST /api/v1/admin/assignments/uploaders
   * Assign an uploader to a validator.
   */
  @Post('assignments/uploaders')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async assignUploader(
    @CurrentUser() admin: AuthenticatedUser,
    @Body(new ZodValidationPipe(AssignUploaderBodySchema))
    body: AssignUploaderBody,
  ) {
    const result = await this.assignUploaderUseCase.execute({
      uploaderId: body.uploaderId,
      validatorId: body.validatorId,
      adminId: admin.userId,
    });
    if (result.isErr()) throw result.error;
    return { data: result.value };
  }

  /**
   * DELETE /api/v1/admin/assignments/uploaders/:uploaderId
   * Remove an uploader's validator assignment.
   */
  @Delete('assignments/uploaders/:uploaderId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async removeUploaderAssignment(@Param('uploaderId') uploaderId: string) {
    const result = await this.removeAssignmentUseCase.execute({
      type: 'uploader',
      assigneeId: uploaderId,
    });
    if (result.isErr()) throw result.error;
    return { data: null };
  }

  /**
   * POST /api/v1/admin/assignments/validators
   * Assign a validator to an approver.
   */
  @Post('assignments/validators')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async assignValidator(
    @CurrentUser() admin: AuthenticatedUser,
    @Body(new ZodValidationPipe(AssignValidatorBodySchema))
    body: AssignValidatorBody,
  ) {
    const result = await this.assignValidatorUseCase.execute({
      validatorId: body.validatorId,
      approverId: body.approverId,
      adminId: admin.userId,
    });
    if (result.isErr()) throw result.error;
    return { data: result.value };
  }

  /**
   * DELETE /api/v1/admin/assignments/validators/:validatorId
   * Remove a validator's approver assignment.
   */
  @Delete('assignments/validators/:validatorId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async removeValidatorAssignment(@Param('validatorId') validatorId: string) {
    const result = await this.removeAssignmentUseCase.execute({
      type: 'validator',
      assigneeId: validatorId,
    });
    if (result.isErr()) throw result.error;
    return { data: null };
  }

  /**
   * DELETE /api/v1/admin/users/:id
   * Delete a user. Admins cannot delete themselves.
   */
  @Delete('users/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    const result = await this.deleteUserUseCase.execute({
      userId,
      requesterId: admin.userId,
    });
    if (result.isErr()) throw result.error;
  }

  /**
   * GET /api/v1/admin/assignments/tree
   * Returns the full hierarchy for the admin tree diagram.
   */
  @Get('assignments/tree')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async getTree() {
    const result = await this.getAssignmentTreeUseCase.execute();
    if (result.isErr()) throw result.error;
    return { data: result.value };
  }
}
