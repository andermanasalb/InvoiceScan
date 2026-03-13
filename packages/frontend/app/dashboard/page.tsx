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
import { useAuth } from '@/context/auth-context';
import { InvoiceCharts } from '@/components/dashboard/invoice-charts';
import { useSendToApproval } from '@/hooks/use-invoice-mutations';

export default function DashboardPage() {
  const { role, userId } = useAuth();

  // Fetch the 10 most recent invoices for the Recent Activity table + charts
  const { data, isLoading } = useInvoices({ limit: 10 });

  // Fetch accurate counts per status using limit:1 (only meta.total matters)
  const { data: pendingData, isLoading: isLoadingPending } = useInvoices({ status: 'READY_FOR_APPROVAL', limit: 1 });
  const { data: approvedData, isLoading: isLoadingApproved } = useInvoices({ status: 'APPROVED', limit: 1 });
  const { data: rejectedData, isLoading: isLoadingRejected } = useInvoices({ status: 'REJECTED', limit: 1 });
  const { data: extractedData, isLoading: isLoadingExtracted } = useInvoices({ status: 'EXTRACTED', limit: 1 });

  const invoices = data?.data ?? [];
  const isStatsLoading = isLoading || isLoadingPending || isLoadingApproved || isLoadingRejected || isLoadingExtracted;

  const total = data?.meta?.total ?? 0;
  const pendingApproval = pendingData?.meta?.total ?? 0;
  const approvedCount = approvedData?.meta?.total ?? 0;
  const rejectedCount = rejectedData?.meta?.total ?? 0;
  const extractedCount = extractedData?.meta?.total ?? 0;

  const canApprove = role === 'approver' || role === 'admin';
  const canReview = role === 'validator' || role === 'approver' || role === 'admin';

  const sendToApproval = useSendToApproval();

  return (
    <AppShell 
      title="Dashboard" 
      pendingCount={pendingApproval}
      extractedCount={extractedCount}
    >
      {/* Needs Your Review - for validators */}
      {canReview && !canApprove && extractedCount > 0 && (
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
                  {extractedCount} invoice{extractedCount !== 1 ? 's' : ''} awaiting validator review
                </p>
              </div>
              <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
                <Link href="/invoices?status=EXTRACTED">
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
                value={extractedCount} 
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
