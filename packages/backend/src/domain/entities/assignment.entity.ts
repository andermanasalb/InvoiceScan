/**
 * Pure domain entities for the user assignment hierarchy.
 *
 * UploaderValidatorAssignment — links one uploader to one validator.
 * ValidatorApproverAssignment — links one validator to one approver.
 *
 * These are simple value-carrying entities (no rich behaviour needed).
 */

export interface UploaderValidatorAssignment {
  id: string;
  uploaderId: string;
  validatorId: string;
  createdBy: string;
  createdAt: Date;
}

export interface ValidatorApproverAssignment {
  id: string;
  validatorId: string;
  approverId: string;
  createdBy: string;
  createdAt: Date;
}

/** Full hierarchy tree returned to the admin UI. */
export interface AssignmentTree {
  unassignedUploaders: UserNode[];
  unassignedValidators: UserNode[];
  unassignedApprovers: UserNode[];
  approvers: ApproverNode[];
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
