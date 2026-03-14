/**
 * @file Login page.
 *
 * Renders the sign-in form with email/password fields and a collapsible
 * "Demo credentials" panel pre-filled with one entry per role.
 *
 * Handles:
 *   - Form validation via react-hook-form
 *   - 401 (wrong credentials) and 429 (rate limit) error states
 *   - Countdown timer displayed while the rate-limit window is active
 *   - Redirect to /dashboard when the user is already authenticated
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, FileIcon, ChevronDown } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { ApiError } from '@/types/auth';

type LoginFormData = {
  email: string;
  password: string;
};

const DEMO_USERS = [
  { role: 'admin',     email: 'admin@invoicescan.com',     password: 'Admin1234!',     color: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/20' },
  { role: 'approver',  email: 'approver@invoicescan.com',  password: 'Approver1234!',  color: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20' },
  { role: 'validator', email: 'validator@invoicescan.com', password: 'Validator1234!', color: 'bg-amber-500/15 text-amber-400 ring-amber-500/20' },
  { role: 'uploader',  email: 'uploader@invoicescan.com',  password: 'Uploader1234!',  color: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/20' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;

    const timer = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  const onSubmit = async (data: LoginFormData) => {
    setError(null);

    try {
      await login(data);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      
      if (axiosError.response?.status === 429) {
        setRateLimitCountdown(60);
        setError('Too many attempts. Try again in 60 seconds.');
      } else if (axiosError.response?.status === 401) {
        setError('Invalid email or password');
      } else {
        setError('An error occurred. Please try again.');
      }
    }
  };

  const isDisabled = isSubmitting || authLoading || rateLimitCountdown !== null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Glass card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-xl backdrop-blur-xl">
          {/* Logo */}
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10">
              <FileIcon className="h-6 w-6 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              InvoiceScan
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Sign in to your account
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mb-6 rounded-xl border border-zinc-700/60 bg-zinc-800/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setDemoOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Demo credentials
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${demoOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {demoOpen && (
              <div className="border-t border-zinc-700/60 divide-y divide-zinc-700/40">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.role}
                    type="button"
                    onClick={() => {
                      setValue('email', u.email);
                      setValue('password', u.password);
                      setDemoOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-700/30 transition-colors group"
                  >
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset shrink-0 ${u.color}`}>
                      {u.role}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300 truncate">{u.email}</p>
                      <p className="text-xs text-zinc-500 font-mono">{u.password}</p>
                    </div>
                    <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0">
                      usar
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isDisabled}
                {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address' },
                  })}
                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500"
              />
              {errors.email && (
                <p className="text-xs text-rose-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isDisabled}
                  {...register('password', { required: 'Password is required' })}
                  className="border-zinc-700 bg-zinc-800 pr-10 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-400">{errors.password.message}</p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
              >
                {error}
                {rateLimitCountdown !== null && (
                  <span className="ml-1 font-mono">({rateLimitCountdown}s)</span>
                )}
              </motion.p>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isDisabled}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50"
            >
              {isSubmitting || authLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
