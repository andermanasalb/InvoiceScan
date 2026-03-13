'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cardHoverVariants } from '@/components/layout/page-transition';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  index?: number;
}

export function StatCard({ title, value, icon: Icon, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      variants={cardHoverVariants}
      whileHover="hover"
      className={cn(
        'relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6',
        'cursor-default'
      )}
    >
      {/* Icon in top right */}
      <div className="absolute right-4 top-4">
        <Icon className="h-5 w-5 text-indigo-400" />
      </div>

      {/* Value */}
      <div className="mb-1 text-3xl font-bold text-zinc-50">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {/* Label */}
      <div className="text-sm text-zinc-500">{title}</div>
    </motion.div>
  );
}
