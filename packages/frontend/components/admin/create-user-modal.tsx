'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useCreateUser } from '@/hooks/use-admin';

const PASSWORD_RULES = [
  { label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)',   test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)',   test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number (0–9)',             test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character (!@#…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserModal({ open, onOpenChange }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('uploader');
  const createUser = useCreateUser();
  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      { email, password, role },
      {
        onSuccess: () => {
          setEmail('');
          setPassword('');
          setRole('uploader');
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEmail('');
      setPassword('');
      setRole('uploader');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create User</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Add a new user to the system. They can log in immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500"
            />
            {password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <li key={rule.label} className="flex items-center gap-2 text-xs">
                      {ok
                        ? <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                        : <X className="h-3 w-3 text-zinc-500 shrink-0" />}
                      <span className={ok ? 'text-emerald-400' : 'text-zinc-500'}>
                        {rule.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-zinc-300">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800">
                <SelectItem value="uploader" className="text-zinc-100 focus:bg-zinc-700">Uploader</SelectItem>
                <SelectItem value="validator" className="text-zinc-100 focus:bg-zinc-700">Validator</SelectItem>
                <SelectItem value="approver" className="text-zinc-100 focus:bg-zinc-700">Approver</SelectItem>
                <SelectItem value="admin" className="text-zinc-100 focus:bg-zinc-700">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createUser.isPending}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createUser.isPending || !email || !passwordValid}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {createUser.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Creating…
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
