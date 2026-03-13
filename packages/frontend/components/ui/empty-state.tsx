'use client';

import { motion } from 'framer-motion';
import { FileX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  action, 
  icon: Icon = FileX,
  className 
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-zinc-800/50 p-4">
        <Icon className="h-8 w-8 text-zinc-600" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-300">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-zinc-500">{description}</p>
      {action}
    </motion.div>
  );
}
