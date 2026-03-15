'use client';

import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { StatusBadge } from './status-badge';
import { staggerContainer, staggerItem } from '@/components/layout/page-transition';
import type { InvoiceEvent, InvoiceStatus } from '@invoice-flow/shared';

interface InvoiceEventTimelineProps {
  events: InvoiceEvent[];
}

export function InvoiceEventTimeline({ events }: InvoiceEventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-zinc-500">No history yet</p>
      </div>
    );
  }

  // Sort events by timestamp, newest first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-0"
    >
      {sortedEvents.map((event, index) => {
        const isLast = index === sortedEvents.length - 1;

        return (
          <motion.div
            key={event.id}
            variants={staggerItem}
            className="relative flex gap-4"
          >
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              <div
                className="relative z-10 flex h-3 w-3 items-center justify-center rounded-full"
                style={{ backgroundColor: getStatusColor(event.to) }}
              />
              {/* Line */}
              {!isLast && (
                <div className="w-0.5 flex-1 bg-zinc-800" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              {/* Status change */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={event.from as InvoiceStatus} size="sm" />
                <span className="text-xs text-zinc-600">→</span>
                <StatusBadge status={event.to as InvoiceStatus} size="sm" />
              </div>

              {/* Timestamp */}
              <div className="mb-1 text-xs text-zinc-400">
                {format(new Date(event.timestamp), "MMM d, yyyy 'at' HH:mm")}
              </div>

              {/* User ID */}
              <div className="text-xs text-zinc-600">
                by User ID: {event.userId.slice(0, 8)}...
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: '#71717A',     // zinc-500
    PROCESSING: '#3B82F6',  // blue-500
    EXTRACTED: '#06B6D4',   // cyan-500
    VALIDATION_FAILED: '#F43F5E', // rose-500
    READY_FOR_APPROVAL: '#F59E0B', // amber-500
    APPROVED: '#10B981',    // emerald-500
    REJECTED: '#EF4444',    // red-500
  };
  return colors[status] || '#71717A';
}
