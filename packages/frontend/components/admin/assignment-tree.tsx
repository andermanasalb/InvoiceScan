'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, X, UserCircle2, Shield, CheckSquare, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useRemoveUploaderAssignment,
  useRemoveValidatorAssignment,
} from '@/hooks/use-admin';
import type { AssignmentTree, ApproverNode, ValidatorNode, UserNode } from '@invoice-flow/shared';

const roleColors: Record<string, string> = {
  approver:  'border-amber-500/30 text-amber-400',
  validator: 'border-cyan-500/30 text-cyan-400',
  uploader:  'border-zinc-500/30 text-zinc-400',
};

const roleIcons: Record<string, React.ElementType> = {
  approver:  Shield,
  validator: CheckSquare,
  uploader:  Upload,
};

function UploaderRow({ user, onRemove }: { user: UserNode; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-zinc-800/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <Upload className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-sm text-zinc-300">{user.email}</span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        className="h-6 w-6 text-zinc-500 hover:bg-zinc-700 hover:text-rose-400"
        title="Remove assignment"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ValidatorBlock({
  validator,
  onRemoveUploader,
  onRemoveValidator,
}: {
  validator: ValidatorNode;
  onRemoveUploader: (uploaderId: string) => void;
  onRemoveValidator: (validatorId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5">
      {/* Validator header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-cyan-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-cyan-500" />
          )}
          <CheckSquare className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-cyan-300">{validator.email}</span>
          <Badge className="ml-1 bg-cyan-500/10 text-cyan-500 text-xs">
            {validator.uploaders.length} uploader{validator.uploaders.length !== 1 ? 's' : ''}
          </Badge>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemoveValidator(validator.userId)}
          className="h-6 w-6 text-zinc-500 hover:bg-zinc-700 hover:text-rose-400"
          title="Remove validator from this approver"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Uploaders */}
      {expanded && (
        <div className="border-t border-cyan-500/10 px-4 pb-3 pt-2 space-y-2">
          {validator.uploaders.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No uploaders assigned</p>
          ) : (
            validator.uploaders.map((u) => (
              <UploaderRow
                key={u.userId}
                user={u}
                onRemove={() => onRemoveUploader(u.userId)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ApproverBlock({ approver }: { approver: ApproverNode }) {
  const [expanded, setExpanded] = useState(true);
  const removeUploaderAssignment = useRemoveUploaderAssignment();
  const removeValidatorAssignment = useRemoveValidatorAssignment();

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      {/* Approver header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-amber-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-amber-500" />
        )}
        <Shield className="h-4 w-4 text-amber-400" />
        <span className="font-medium text-amber-300">{approver.email}</span>
        <Badge className="ml-1 bg-amber-500/10 text-amber-500 text-xs">
          {approver.validators.length} validator{approver.validators.length !== 1 ? 's' : ''}
        </Badge>
      </button>

      {/* Validators */}
      {expanded && (
        <div className="mt-3 space-y-2 pl-6">
          {approver.validators.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No validators assigned</p>
          ) : (
            approver.validators.map((v) => (
              <ValidatorBlock
                key={v.userId}
                validator={v}
                onRemoveUploader={(uid) =>
                  removeUploaderAssignment.mutate(uid)
                }
                onRemoveValidator={(vid) =>
                  removeValidatorAssignment.mutate(vid)
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function UnassignedRow({ user }: { user: UserNode }) {
  const Icon = roleIcons[user.role] ?? UserCircle2;
  return (
    <div className="flex items-center gap-2 rounded-md bg-zinc-800/60 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-zinc-500" />
      <span className="text-sm text-zinc-400">{user.email}</span>
      <Badge
        variant="outline"
        className={cn('ml-auto text-xs', roleColors[user.role] ?? '')}
      >
        {user.role}
      </Badge>
    </div>
  );
}

interface AssignmentTreeViewProps {
  tree: AssignmentTree;
}

export function AssignmentTreeView({ tree }: AssignmentTreeViewProps) {
  const hasUnassigned =
    tree.unassignedUploaders.length > 0 ||
    tree.unassignedValidators.length > 0;

  return (
    <div className="space-y-6">
      {/* Assigned hierarchy */}
      <div className="space-y-4">
        {tree.approvers.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 p-8 text-center text-zinc-500">
            No approvers in the system yet. Create users to get started.
          </div>
        ) : (
          tree.approvers.map((approver) => (
            <ApproverBlock key={approver.userId} approver={approver} />
          ))
        )}
      </div>

      {/* Unassigned users */}
      {hasUnassigned && (
        <div className="rounded-xl border border-zinc-800 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-400">
            Unassigned users
          </h3>
          <div className="space-y-2">
            {[...tree.unassignedValidators, ...tree.unassignedUploaders].map(
              (u) => (
                <UnassignedRow key={u.userId} user={u} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
