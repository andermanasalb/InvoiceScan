'use client';

import { cn } from '@/lib/utils';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 7, className }: SkeletonTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-800', className)}>
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="h-4 flex-1 animate-shimmer rounded"
            style={{ maxWidth: i === 0 ? '60px' : i === 1 ? '120px' : '100px' }}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="flex items-center gap-4 border-b border-zinc-800/50 px-4 py-4 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-4 flex-1 animate-shimmer rounded"
              style={{ 
                maxWidth: colIndex === 0 ? '60px' : colIndex === 1 ? '120px' : '100px',
                animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-900 p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="h-8 w-24 animate-shimmer rounded" />
          <div className="h-4 w-32 animate-shimmer rounded" />
        </div>
        <div className="h-5 w-5 animate-shimmer rounded" />
      </div>
    </div>
  );
}
