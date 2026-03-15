/**
 * Re-exports from @invoice-flow/shared — single source of truth.
 * This file exists only for backwards compatibility with existing imports.
 * Prefer importing directly from '@invoice-flow/shared' in new code.
 */
export type {
  UserNode,
  ValidatorNode,
  ApproverNode,
  AssignmentTree,
} from '@invoice-flow/shared';

import type { UserRole } from '@invoice-flow/shared';

/** Frontend alias — same set of roles as UserRole. */
export type AdminRole = UserRole;

/** Admin user record as returned by GET /api/v1/admin/users. */
export interface AdminUser {
  userId: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}
