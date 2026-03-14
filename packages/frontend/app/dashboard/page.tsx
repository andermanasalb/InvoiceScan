/**
 * @file Dashboard page
 *
 * Shows an overview of invoice activity for the authenticated user:
 *   - action banners for roles that have pending work
 *   - stat cards (total, pending approval / awaiting review, approved, rejected)
 *   - a chart section summarising the recent invoice distribution
 *   - a "Recent Activity" table of the 10 most recent invoices
 *
 * Stats are fetched in a single GET /invoices/stats request (one GROUP BY
 * query on the backend) rather than four separate status-filtered requests.
 */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Search,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { SkeletonTable, SkeletonCard } from '@/components/ui/skeleton-table';
import { EmptyState } from '@/components/ui/empty-state';
import { useInvoices } from '@/hooks/use-invoices';
import { useInvoiceStats } from '@/hooks/use-invoice-stats';
import { useAuth } from '@/context/auth-context';
import { InvoiceCharts } from '@/components/dashboard/invoice-charts';
import { useSendToApproval } from '@/hooks/use-invoice-mutations';

export default function DashboardPage() {
  const { role, userId } = useAuth();

  // Fetch the 10 most recent invoices for the Recent Activity table + charts
  const { data, isLoading } = useInvoices({ limit: 10 });

  // Single request → backend GROUP BY status (replaces 4× useInvoices calls)
  const { data: statsData, isLoading: isStatsLoading } = useInvoiceStats();

  const invoices = data?.data ?? [];
  const stats = statsData ?? {};

  const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
  const pendingApproval = stats['READY_FOR_APPROVAL'] ?? 0;
  const approvedCount = stats['APPROVED'] ?? 0;
  const rejectedCount = stats['REJECTED'] ?? 0;
  const extractedCount = stats['EXTRACTED'] ?? 0;
  // Invoices awaiting validator review (uploader already sent them to validation)
  const readyForValidationCount = stats['READY_FOR_VALIDATION'] ?? 0;

  const canApprove = role === 'approver' || role === 'admin';
  const canReview = role === 'validator' || role === 'approver' || role === 'admin';

  // Count shown in sidebar badge and stat card depends on role:
  // - uploader: EXTRACTED (their own invoices waiting for them to send to validation)
  // - validator/approver/admin: READY_FOR_VALIDATION (invoices waiting for their review)
  const needsReviewCount = canReview ? readyForValidationCount : extractedCount;

  const sendToApproval = useSendToApproval();

  return (
    <AppShell 
      title="Dashboard" 
      pendingCount={pendingApproval}
      extractedCount={needsReviewCount}
    >
      {/* Needs Your Review - for validators/approvers (READY_FOR_VALIDATION) */}
      {canReview && !canApprove && readyForValidationCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-cyan-400">
                  Needs Your Review
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {readyForValidationCount} invoice{readyForValidationCount !== 1 ? 's' : ''} ready for validation
                </p>
              </div>
              <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
                <Link href="/invoices?status=READY_FOR_VALIDATION">
                  Review Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Needs Your Action - for approvers/admins */}
      {canApprove && pendingApproval > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-amber-400">
                  Needs Your Action
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {pendingApproval} invoice{pendingApproval !== 1 ? 's' : ''} waiting for approval
                </p>
              </div>
              <Button asChild className="bg-amber-600 text-white hover:bg-amber-700">
                <Link href="/invoices?status=READY_FOR_APPROVAL">
                  Review Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isStatsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard 
              title="Total Invoices" 
              value={total} 
              icon={FileText}
              index={0}
            />
            {canReview && !canApprove ? (
              <StatCard 
                title="Awaiting Review" 
                value={readyForValidationCount} 
                icon={Search}
                index={1}
              />
            ) : (
              <StatCard 
                title="Pending Approval" 
                value={pendingApproval} 
                icon={Clock}
                index={1}
              />
            )}
            <StatCard 
              title="Approved" 
              value={approvedCount} 
              icon={CheckCircle2}
              index={2}
            />
            <StatCard 
              title="Rejected" 
              value={rejectedCount} 
              icon={XCircle}
              index={3}
            />
          </>
        )}
      </div>

      {/* Dynamic Charts Area */}
      <InvoiceCharts invoices={invoices} isLoading={isLoading} />

      {/* Recent Activity */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
            Recent Activity
          </h2>
          <Button asChild variant="ghost" className="text-zinc-400 hover:text-zinc-200">
            <Link href="/invoices">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Upload your first invoice to get started."
            action={
              <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
                <Link href="/upload">Upload Invoice</Link>
              </Button>
            }
          />
        ) : (
          <InvoiceTable 
            invoices={invoices.slice(0, 10)} 
            userRole={role}
            userId={userId}
            onSendToApproval={(id) => sendToApproval.mutate(id)}
            isSendingToApproval={sendToApproval.isPending}
          />
        )}
      </div>
    </AppShell>
  );
}
