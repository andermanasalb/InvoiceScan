'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    // Wait until auth state is fully resolved (sessionStorage read on client)
    // before deciding where to redirect. Without this guard the SSR pass sees
    // isAuthenticated=false and immediately redirects to /login even when the
    // user has a valid session stored in sessionStorage.
    if (!isInitialized) return;

    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#09090B]">
      <Spinner className="h-8 w-8 text-indigo-500" />
    </div>
  );
}
