'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  CheckSquare,
  Users,
  GitBranch,
  LogOut,
  FileIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@invoice-flow/shared';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: number;
  badgeColor?: 'amber' | 'cyan';
  comingSoon?: boolean;
}

const getNavItems = (role: UserRole | null, pendingCount?: number, extractedCount?: number): NavItem[] => {
  const items: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['uploader', 'validator', 'approver', 'admin'],
    },
    {
      href: '/invoices',
      label: role === 'uploader' ? 'My Invoices' : 'All Invoices',
      icon: FileText,
      roles: ['uploader', 'validator', 'approver', 'admin'],
    },
    {
      href: '/upload',
      label: 'Upload Invoice',
      icon: Upload,
      roles: ['uploader', 'validator', 'approver', 'admin'],
    },
  ];

  // Add Needs Review for validator (and approver/admin for completeness)
  // Links to READY_FOR_VALIDATION — where invoices land after uploader sends them
  if (role === 'validator' || role === 'approver' || role === 'admin') {
    items.push({
      href: '/invoices?status=READY_FOR_VALIDATION',
      label: 'Needs Review',
      icon: CheckSquare,
      roles: ['validator', 'approver', 'admin'],
      badge: extractedCount,
      badgeColor: 'cyan' as const,
    });
  }

  // Add Pending Approval for approver and admin
  if (role === 'approver' || role === 'admin') {
    items.push({
      href: '/invoices?status=READY_FOR_APPROVAL',
      label: 'Pending Approval',
      icon: CheckSquare,
      roles: ['approver', 'admin'],
      badge: pendingCount,
      badgeColor: 'amber' as const,
    });
  }

  // Add admin-only items
  if (role === 'admin') {
    items.push(
      {
        href: '/admin/users',
        label: 'Users',
        icon: Users,
        roles: ['admin'],
      },
      {
        href: '/admin/assignments',
        label: 'Assignments',
        icon: GitBranch,
        roles: ['admin'],
      },
    );
  }

  return items;
};

interface SidebarProps {
  pendingCount?: number;
  extractedCount?: number;
}

export function Sidebar({ pendingCount, extractedCount }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, email, logout, isLoading } = useAuth();
  const navItems = getNavItems(role, pendingCount, extractedCount);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (href.includes('?')) {
      const search = searchParams.toString();
      return pathname + (search ? `?${search}` : '') === href;
    }
    return pathname.startsWith(href) && href !== '/dashboard';
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-zinc-800 bg-[#09090B]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-800 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
          <FileIcon className="h-4 w-4 text-indigo-500" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-zinc-50">
          InvoiceScan
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          if (item.comingSoon) {
            return (
              <div
                key={item.label}
                className="relative flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600"
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                <Badge variant="outline" className="ml-auto text-[10px] text-zinc-600">
                  Soon
                </Badge>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative block"
            >
              {active && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute inset-0 rounded-lg bg-indigo-500/10"
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 30,
                  }}
                />
              )}
              <div
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'text-indigo-400'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    className={cn(
                      'ml-auto',
                      item.badgeColor === 'cyan'
                        ? 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/10'
                        : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/10'
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User info & logout */}
      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3 rounded-lg bg-zinc-900 p-3">
          <div className="mb-1 truncate text-sm font-medium text-zinc-200">
            {email ?? 'User'}
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs capitalize',
              role === 'admin' && 'border-indigo-500/30 text-indigo-400',
              role === 'approver' && 'border-amber-500/30 text-amber-400',
              role === 'validator' && 'border-cyan-500/30 text-cyan-400',
              role === 'uploader' && 'border-zinc-500/30 text-zinc-400'
            )}
          >
            {role || 'unknown'}
          </Badge>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          onClick={logout}
          disabled={isLoading}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  );
}
