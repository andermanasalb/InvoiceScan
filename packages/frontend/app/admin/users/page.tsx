'use client';

import { useState } from 'react';
import { UserPlus, Shield, CheckSquare, Upload, Users, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateUserModal } from '@/components/admin/create-user-modal';
import { useAdminUsers, useDeleteUser } from '@/hooks/use-admin';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const ROLE_CONFIG = {
  admin:     { label: 'Admin',     color: 'border-indigo-500/30 text-indigo-400', Icon: Shield },
  approver:  { label: 'Approver',  color: 'border-amber-500/30  text-amber-400',  Icon: Shield },
  validator: { label: 'Validator', color: 'border-cyan-500/30   text-cyan-400',   Icon: CheckSquare },
  uploader:  { label: 'Uploader',  color: 'border-zinc-500/30   text-zinc-400',   Icon: Upload },
} as const;

export default function AdminUsersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: users, isLoading } = useAdminUsers();
  const { userId: currentUserId } = useAuth();
  const deleteUser = useDeleteUser();

  const grouped = {
    admin:     users?.filter((u) => u.role === 'admin')     ?? [],
    approver:  users?.filter((u) => u.role === 'approver')  ?? [],
    validator: users?.filter((u) => u.role === 'validator') ?? [],
    uploader:  users?.filter((u) => u.role === 'uploader')  ?? [],
  };

  return (
    <AppShell
      title="User Management"
      breadcrumb="Admin"
      action={
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      }
    >
      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(Object.keys(ROLE_CONFIG) as (keyof typeof ROLE_CONFIG)[]).map((role) => {
          const { label, Icon } = ROLE_CONFIG[role];
          return (
            <div
              key={role}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                  {label}s
                </span>
              </div>
              <p className="text-2xl font-semibold text-zinc-100">
                {isLoading ? '—' : grouped[role].length}
              </p>
            </div>
          );
        })}
      </div>

      {/* User table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
          <p className="text-zinc-400">No users yet.</p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Create your first user
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-zinc-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-zinc-500">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-zinc-500">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const cfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.uploader;
                const isSelf = user.userId === currentUserId;
                return (
                  <tr
                    key={user.userId}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-zinc-200">{user.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn('capitalize text-xs', cfg.color)}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => deleteUser.mutate(user.userId)}
                          disabled={deleteUser.isPending}
                          className="text-zinc-600 hover:text-rose-400 transition-colors disabled:opacity-40"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
