'use client';

import { motion } from 'framer-motion';
import { 
  Clock, 
  Loader2, 
  Sparkles, 
  AlertTriangle, 
  Eye, 
  CheckCircle2, 
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@invoice-flow/shared';

const statusConfig: Record<InvoiceStatus, {
  label: string;
  icon: React.ElementType;
  className: string;
  iconClassName?: string;
}> = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
  PROCESSING: {
    label: 'Processing',
    icon: Loader2,
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    iconClassName: 'animate-spin',
  },
  EXTRACTED: {
    label: 'Extracted',
    icon: Sparkles,
    className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  VALIDATION_FAILED: {
    label: 'Validation Failed',
    icon: AlertTriangle,
    className: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  READY_FOR_VALIDATION: {
    label: 'Needs Validation',
    icon: ShieldCheck,
    className: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  },
  READY_FOR_APPROVAL: {
    label: 'Ready for Approval',
    icon: Eye,
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

interface StatusBadgeProps {
  status: InvoiceStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function StatusBadge({ status, size = 'md', showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <motion.span
      layout
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.className,
        sizeClasses[size]
      )}
    >
      {showIcon && (
        <Icon className={cn(iconSizes[size], config.iconClassName)} />
      )}
      <span>{config.label}</span>
    </motion.span>
  );
}

// Export status config for use in other components
export { statusConfig };
