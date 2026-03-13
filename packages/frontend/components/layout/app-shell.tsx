'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { PageTransition } from './page-transition';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: React.ReactNode;
  action?: React.ReactNode;
  pendingCount?: number;
  extractedCount?: number;
}

export function AppShell({ 
  children, 
  title, 
  breadcrumb, 
  action,
  pendingCount,
  extractedCount,
}: AppShellProps) {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();
  // mounted evita hydration mismatch: SSR y el primer render cliente
  // son idénticos (ambos muestran spinner) hasta que useEffect se ejecuta
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Solo redirigir cuando ya sabemos con certeza que no hay sesión
    if (mounted && isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isAuthenticated, isInitialized, router]);

  // Spinner mientras: SSR, hidratación, o sin sesión confirmada
  if (!mounted || !isInitialized || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090B]">
        <Spinner className="h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B]">
      <Sidebar pendingCount={pendingCount} extractedCount={extractedCount} />
      
      {/* Main content area */}
      <main className="ml-60 min-h-screen">
        {/* Top header bar */}
        {(title || breadcrumb || action) && (
          <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#09090B]/80 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between px-8">
              <div className="flex flex-col">
                {breadcrumb && (
                  <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                    {breadcrumb}
                  </div>
                )}
                {title && (
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
                    {title}
                  </h1>
                )}
              </div>
              {action && <div>{action}</div>}
            </div>
          </header>
        )}

        {/* Page content */}
        <div className="p-8">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
