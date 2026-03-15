/**
 * @file Invoice list page.
 *
 * Displays a filterable, paginated table of all invoices visible to the
 * authenticated user (uploaders see only their own; other roles see all).
 *
 * Filter state (status, sort, page) is kept in the URL search params so that
 * browser back/forward navigation and deep links work correctly.
 */
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ApproveDialog } from '@/components/invoices/approve-dialog';
import { RejectModal } from '@/components/invoices/reject-modal';
import { SendToApprovalModal } from '@/components/invoices/send-to-approval-modal';
import { ExportButton } from '@/components/invoices/export-button';
import { useInvoices } from '@/hooks/use-invoices';
import { useApproveInvoice, useRejectInvoice, useSendToApprovalWithNote, useSendToValidation } from '@/hooks/use-invoice-mutations';
import { useAuth } from '@/context/auth-context';
import type { InvoiceStatus } from '@invoice-flow/shared';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'EXTRACTED', label: 'Extracted' },
  { value: 'VALIDATION_FAILED', label: 'Validation Failed' },
  { value: 'READY_FOR_VALIDATION', label: 'Needs Validation' },
  { value: 'READY_FOR_APPROVAL', label: 'Ready for Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'amount:asc', label: 'Amount (low to high)' },
  { value: 'amount:desc', label: 'Amount (high to low)' },
];

function InvoiceListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, userId } = useAuth();

  // Derive all filter state directly from URL — no useState duplication.
  // This keeps state in sync on browser back/forward navigation.
  const statusParam = (searchParams.get('status') as InvoiceStatus | null) ?? 'ALL';
  const sortParam = searchParams.get('sort') ?? 'createdAt:desc';
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10);

  const status: InvoiceStatus | 'ALL' = statusParam;
  const sort = sortParam;
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit = 20;

  // Approve/Reject/SendToApproval state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [sendToApprovalModalOpen, setSendToApprovalModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const { data, isLoading, isError } = useInvoices({ 
    status: status === 'ALL' ? undefined : status, 
    page, 
    limit, 
    sort 
  });

  // Fetch accurate pending count regardless of current page/filter
  const { data: pendingData } = useInvoices({ status: 'READY_FOR_APPROVAL', limit: 1 });

  const approveMutation = useApproveInvoice();
  const rejectMutation = useRejectInvoice();
  const sendToApprovalMutation = useSendToApprovalWithNote();
  const sendToValidationMutation = useSendToValidation();

  const invoices = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20 };
  const totalPages = Math.ceil(meta.total / limit);

  // Accurate count from targeted query, not from the current page's subset
  const pendingCount = pendingData?.meta?.total ?? 0;

  const updateUrl = (newStatus?: string, newSort?: string, newPage?: number) => {
    const params = new URLSearchParams();
    if (newStatus && newStatus !== 'ALL') params.set('status', newStatus);
    if (newSort && newSort !== 'createdAt:desc') params.set('sort', newSort);
    if (newPage && newPage > 1) params.set('page', newPage.toString());
    
    const queryString = params.toString();
    router.push(queryString ? `/invoices?${queryString}` : '/invoices');
  };

  const handleStatusChange = (value: string) => {
    updateUrl(value, sort, 1);
  };

  const handleSortChange = (value: string) => {
    updateUrl(status, value, page);
  };

  const handlePageChange = (newPage: number) => {
    updateUrl(status, sort, newPage);
  };

  const handleApprove = (id: string) => {
    setSelectedInvoiceId(id);
    setApproveDialogOpen(true);
  };

  const handleReject = (id: string) => {
    setSelectedInvoiceId(id);
    setRejectModalOpen(true);
  };

  const handleSendToApproval = (id: string) => {
    setSelectedInvoiceId(id);
    setSendToApprovalModalOpen(true);
  };

  const confirmApprove = async () => {
    if (!selectedInvoiceId) return;
    await approveMutation.mutateAsync(selectedInvoiceId);
    setApproveDialogOpen(false);
    setSelectedInvoiceId(null);
  };

  const confirmReject = async (reason: string) => {
    if (!selectedInvoiceId) return;
    await rejectMutation.mutateAsync({ id: selectedInvoiceId, reason });
    setRejectModalOpen(false);
    setSelectedInvoiceId(null);
  };

  const pageTitle = role === 'uploader' ? 'My Invoices' : 'All Invoices';

  return (
    <AppShell 
      title={pageTitle}
      pendingCount={pendingCount}
      action={
        <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
          <Link href="/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload Invoice
          </Link>
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-48 border-zinc-700 bg-zinc-800 text-zinc-100">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-800">
            {STATUS_OPTIONS.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-48 border-zinc-700 bg-zinc-800 text-zinc-100">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-800">
            {SORT_OPTIONS.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export — visible for non-uploaders only */}
        {role !== 'uploader' && (
          <ExportButton
            status={status !== 'ALL' ? status : undefined}
            sort={sort !== 'createdAt:desc' ? sort : undefined}
          />
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : isError ? (
        <EmptyState
          title="Failed to load invoices"
          description="There was a problem fetching invoices. Please try again."
          action={
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          }
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description={
            status !== 'ALL'
              ? `No invoices with status "${status.replace(/_/g, ' ').toLowerCase()}"`
              : "Upload your first invoice to get started."
          }
          action={
            <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href="/upload">Upload Invoice</Link>
            </Button>
          }
        />
      ) : (
        <>
          <InvoiceTable 
            invoices={invoices} 
            userRole={role}
            userId={userId}
            onApprove={handleApprove}
            onReject={handleReject}
            onSendToApproval={handleSendToApproval}
            onSendToValidation={(id) => sendToValidationMutation.mutate(id)}
            isApproving={approveMutation.isPending || rejectMutation.isPending}
            isSendingToApproval={sendToApprovalMutation.isPending}
            isSendingToValidation={sendToValidationMutation.isPending}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-zinc-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <ApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        onConfirm={confirmApprove}
        isLoading={approveMutation.isPending}
      />

      <RejectModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        onConfirm={confirmReject}
        isLoading={rejectMutation.isPending}
      />

      <SendToApprovalModal
        open={sendToApprovalModalOpen}
        onOpenChange={setSendToApprovalModalOpen}
        onConfirm={(note) => {
          if (!selectedInvoiceId) return;
          sendToApprovalMutation.mutate({ id: selectedInvoiceId, note });
          setSendToApprovalModalOpen(false);
          setSelectedInvoiceId(null);
        }}
        isLoading={sendToApprovalMutation.isPending}
      />
    </AppShell>
  );
}

export default function InvoiceListPage() {
  return (
    <Suspense fallback={
      <AppShell title="Invoices">
        <SkeletonTable rows={5} />
      </AppShell>
    }>
      <InvoiceListContent />
    </Suspense>
  );
}
