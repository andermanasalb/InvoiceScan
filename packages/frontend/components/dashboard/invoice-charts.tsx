'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { Invoice } from '@/types/invoice';

// Custom tooltip for the charts
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
        <p className="mb-1 text-xs font-medium text-zinc-400">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.value} {entry.name}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#71717A',
  PROCESSING: '#3B82F6',
  EXTRACTED: '#06B6D4',
  VALIDATION_FAILED: '#F43F5E',
  READY_FOR_APPROVAL: '#F59E0B',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  EXTRACTED: 'Extracted',
  VALIDATION_FAILED: 'Val. Failed',
  READY_FOR_APPROVAL: 'For Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

interface InvoiceChartsProps {
  invoices: Invoice[];
  isLoading?: boolean;
}

export function InvoiceCharts({ invoices, isLoading }: InvoiceChartsProps) {
  // Status distribution data
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((inv) => {
      counts[inv.status] = (counts[inv.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status: STATUS_LABELS[status] ?? status,
      rawStatus: status,
      count,
    }));
  }, [invoices]);

  // Monthly trend — last 6 months
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const label = format(date, 'MMM');

      const approved = invoices.filter(
        (inv) =>
          inv.status === 'APPROVED' &&
          new Date(inv.createdAt) >= start &&
          new Date(inv.createdAt) <= end
      ).length;

      const rejected = invoices.filter(
        (inv) =>
          inv.status === 'REJECTED' &&
          new Date(inv.createdAt) >= start &&
          new Date(inv.createdAt) <= end
      ).length;

      const uploaded = invoices.filter(
        (inv) =>
          new Date(inv.createdAt) >= start && new Date(inv.createdAt) <= end
      ).length;

      return { label, approved, rejected, uploaded };
    });
    return months;
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="animate-shimmer h-64 rounded-xl border border-zinc-800 bg-zinc-900" />
        <div className="animate-shimmer h-64 rounded-xl border border-zinc-800 bg-zinc-900" />
      </div>
    );
  }

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      {/* Status Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h3 className="mb-1 text-sm font-semibold tracking-tight text-zinc-100">
          Status Distribution
        </h3>
        <p className="mb-6 text-xs text-zinc-500">Invoice breakdown by current status</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={statusData} barSize={28} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
            <XAxis
              dataKey="status"
              tick={{ fill: '#71717A', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#71717A', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="invoices">
              {statusData.map((entry) => (
                <Cell
                  key={entry.rawStatus}
                  fill={STATUS_COLORS[entry.rawStatus] ?? '#6366F1'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Monthly Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h3 className="mb-1 text-sm font-semibold tracking-tight text-zinc-100">
          Monthly Activity
        </h3>
        <p className="mb-4 text-xs text-zinc-500">Approved vs Rejected — last 6 months</p>

        {/* Legend */}
        <div className="mb-4 flex gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-400">Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-xs text-zinc-400">Rejected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-xs text-zinc-400">Uploaded</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={monthlyData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradUploaded" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#71717A', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#71717A', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="uploaded"
              name="uploaded"
              stroke="#6366F1"
              strokeWidth={2}
              fill="url(#gradUploaded)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366F1' }}
            />
            <Area
              type="monotone"
              dataKey="approved"
              name="approved"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#gradApproved)"
              dot={false}
              activeDot={{ r: 4, fill: '#10B981' }}
            />
            <Area
              type="monotone"
              dataKey="rejected"
              name="rejected"
              stroke="#F43F5E"
              strokeWidth={2}
              fill="url(#gradRejected)"
              dot={false}
              activeDot={{ r: 4, fill: '#F43F5E' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
