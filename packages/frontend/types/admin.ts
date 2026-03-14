export type AdminRole = 'uploader' | 'validator' | 'approver' | 'admin';

export interface AdminUser {
  userId: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

export interface UserNode {
  userId: string;
  email: string;
  role: string;
}

export interface ValidatorNode extends UserNode {
  uploaders: UserNode[];
}

export interface ApproverNode extends UserNode {
  validators: ValidatorNode[];
}

export interface AssignmentTree {
  unassignedUploaders: UserNode[];
  unassignedValidators: UserNode[];
  unassignedApprovers: UserNode[];
  approvers: ApproverNode[];
}
