'use client';

import { useState } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignmentTreeView } from '@/components/admin/assignment-tree';
import {
  useAssignmentTree,
  useAdminUsers,
  useAssignUploader,
  useAssignValidator,
} from '@/hooks/use-admin';

export default function AdminAssignmentsPage() {
  const { data: tree, isLoading: isTreeLoading, refetch } = useAssignmentTree();
  const { data: allUsers } = useAdminUsers();

  const [selectedUploader, setSelectedUploader] = useState('');
  const [selectedValidator, setSelectedValidator] = useState('');
  const [selectedValidatorForApprover, setSelectedValidatorForApprover] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');

  const assignUploader = useAssignUploader();
  const assignValidator = useAssignValidator();

  const uploaders  = allUsers?.filter((u) => u.role === 'uploader')  ?? [];
  const validators = allUsers?.filter((u) => u.role === 'validator') ?? [];
  const approvers  = allUsers?.filter((u) => u.role === 'approver')  ?? [];

  const handleAssignUploader = () => {
    if (!selectedUploader || !selectedValidator) return;
    assignUploader.mutate(
      { uploaderId: selectedUploader, validatorId: selectedValidator },
      {
        onSuccess: () => {
          setSelectedUploader('');
          setSelectedValidator('');
        },
      },
    );
  };

  const handleAssignValidator = () => {
    if (!selectedValidatorForApprover || !selectedApprover) return;
    assignValidator.mutate(
      { validatorId: selectedValidatorForApprover, approverId: selectedApprover },
      {
        onSuccess: () => {
          setSelectedValidatorForApprover('');
          setSelectedApprover('');
        },
      },
    );
  };

  return (
    <AppShell
      title="Assignments"
      breadcrumb="Admin"
      action={
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isTreeLoading}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isTreeLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left — tree diagram (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-100">Hierarchy</h2>
            <p className="text-sm text-zinc-500">
              Approvers → Validators → Uploaders. Click X to remove an assignment.
            </p>
          </div>

          {isTreeLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : tree ? (
            <AssignmentTreeView tree={tree} />
          ) : null}
        </div>

        {/* Right — assignment panels (1/3 width) */}
        <div className="space-y-6">
          {/* Assign uploader → validator */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-zinc-100">
                Assign Uploader to Validator
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Uploader</Label>
                <Select value={selectedUploader} onValueChange={setSelectedUploader}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100 text-sm">
                    <SelectValue placeholder="Select uploader…" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-800">
                    {uploaders.length === 0 ? (
                      <SelectItem value="_none" disabled className="text-zinc-500">No uploaders</SelectItem>
                    ) : (
                      uploaders.map((u) => (
                        <SelectItem key={u.userId} value={u.userId} className="text-zinc-100 focus:bg-zinc-700">
                          {u.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Validator</Label>
                <Select value={selectedValidator} onValueChange={setSelectedValidator}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100 text-sm">
                    <SelectValue placeholder="Select validator…" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-800">
                    {validators.length === 0 ? (
                      <SelectItem value="_none" disabled className="text-zinc-500">No validators</SelectItem>
                    ) : (
                      validators.map((v) => (
                        <SelectItem key={v.userId} value={v.userId} className="text-zinc-100 focus:bg-zinc-700">
                          {v.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAssignUploader}
                disabled={!selectedUploader || !selectedValidator || assignUploader.isPending}
                className="w-full bg-cyan-600 text-white hover:bg-cyan-700"
                size="sm"
              >
                Assign
              </Button>
            </div>
          </div>

          {/* Assign validator → approver */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-zinc-100">
                Assign Validator to Approver
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Validator</Label>
                <Select
                  value={selectedValidatorForApprover}
                  onValueChange={setSelectedValidatorForApprover}
                >
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100 text-sm">
                    <SelectValue placeholder="Select validator…" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-800">
                    {validators.length === 0 ? (
                      <SelectItem value="_none" disabled className="text-zinc-500">No validators</SelectItem>
                    ) : (
                      validators.map((v) => (
                        <SelectItem key={v.userId} value={v.userId} className="text-zinc-100 focus:bg-zinc-700">
                          {v.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Approver</Label>
                <Select value={selectedApprover} onValueChange={setSelectedApprover}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100 text-sm">
                    <SelectValue placeholder="Select approver…" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-800">
                    {approvers.length === 0 ? (
                      <SelectItem value="_none" disabled className="text-zinc-500">No approvers</SelectItem>
                    ) : (
                      approvers.map((a) => (
                        <SelectItem key={a.userId} value={a.userId} className="text-zinc-100 focus:bg-zinc-700">
                          {a.email}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAssignValidator}
                disabled={
                  !selectedValidatorForApprover ||
                  !selectedApprover ||
                  assignValidator.isPending
                }
                className="w-full bg-amber-600 text-white hover:bg-amber-700"
                size="sm"
              >
                Assign
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
