'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [isInitialized, role, router]);

  if (!isInitialized || role !== 'admin') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090B]">
        <Spinner className="h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  return <>{children}</>;
}
