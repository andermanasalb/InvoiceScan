/**
 * @file Invoice detail page.
 *
 * Displays full metadata for a single invoice, its status stepper, extracted
 * data, action buttons (approve / reject / send-to-validation / retry), and
 * an event-history timeline in the right sidebar.
 *
 * Notes are rendered by the <InvoiceNotes> component (extracted from this file).
 * Role/ownership permission flags come from the useInvoicePermissions hook.
 * Currency formatting uses the shared formatAmount() util from @/lib/utils.
 */
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, isValid } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  User,
  Calendar,
  DollarSign,
  Building2,
  Upload,
  Send,
  RefreshCw,
  Loader2,
  Hash,
  Receipt,
  FileDigit,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { CopyableId } from '@/components/ui/copyable-id';
import { StatusBadge } from '@/components/invoices/status-badge';
import { StatusStepper } from '@/components/invoices/status-stepper';
import { InvoiceEventTimeline } from '@/components/invoices/invoice-event-timeline';
import { ApproveDialog } from '@/components/invoices/approve-dialog';
import { RejectModal } from '@/components/invoices/reject-modal';
import { SendToApprovalModal } from '@/components/invoices/send-to-approval-modal';
import { InvoiceNotes } from '@/components/invoices/invoice-notes';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvoice } from '@/hooks/use-invoice';
import { useInvoiceEvents } from '@/hooks/use-invoice-events';
import { useApproveInvoice, useRejectInvoice, useSendToApprovalWithNote, useSendToValidation, useRetryInvoice } from '@/hooks/use-invoice-mutations';
import { useInvoicePermissions } from '@/hooks/use-invoice-permissions';
import { useAuth } from '@/context/auth-context';
import { formatProviderName } from '@invoice-flow/shared';
import { formatAmount } from '@/lib/utils';
import { invoiceApi } from '@/lib/api';

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const { role, userId } = useAuth();

  const { data: invoice, isLoading: isLoadingInvoice, isError: isInvoiceError } = useInvoice(invoiceId);
  const { data: events = [], isLoading: isLoadingEvents } = useInvoiceEvents(invoiceId, invoice?.status);

  const approveMutation = useApproveInvoice();
  const rejectMutation = useRejectInvoice();
  const sendToApprovalMutation = useSendToApprovalWithNote();
  const sendToValidationMutation = useSendToValidation();
  const retryMutation = useRetryInvoice();

  const isOwner = !!userId && invoice?.uploaderId === userId;

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [sendToApprovalModalOpen, setSendToApprovalModalOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const handleViewPdf = async () => {
    setIsPdfLoading(true);
    try {
      const blob = await invoiceApi.getFile(invoiceId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a delay to allow the tab to load it
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      // silently fail — unlikely since auth is already verified
    } finally {
      setIsPdfLoading(false);
    }
  };

  const {
    canApprove,
    canRejectAtExtracted,
    canRejectFromValidation,
    canSendToValidation,
    canSendToApproval,
    canRetry,
    canAddNote,
  } = useInvoicePermissions({ invoice, role, userId });

  const confirmApprove = async () => {
    await approveMutation.mutateAsync(invoiceId);
    setApproveDialogOpen(false);
  };

  const confirmReject = async (reason: string) => {
    await rejectMutation.mutateAsync({ id: invoiceId, reason });
    setRejectModalOpen(false);
  };

  return (
    <AppShell
      title="Invoice Details"
      breadcrumb={
        <Link 
          href="/invoices" 
          className="flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to Invoices
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Invoice details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            {isLoadingInvoice ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : isInvoiceError ? (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-6 text-center text-rose-400">
                Failed to load invoice. Please try again.
              </div>
            ) : invoice ? (
              <>
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <h2 className="font-mono text-lg text-zinc-100">
                        Invoice
                      </h2>
                      <CopyableId id={invoice.invoiceId} truncate={false} />
                    </div>
                    <div className="mb-2">
                      <StatusBadge status={invoice.status} size="lg" />
                    </div>
                  </div>
                  {/* View original PDF */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewPdf}
                    disabled={isPdfLoading}
                    className="shrink-0 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    {isPdfLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    View PDF
                    <ExternalLink className="ml-2 h-3.5 w-3.5 text-zinc-500" />
                  </Button>
                </div>

                {/* Status Stepper */}
                <div className="mb-8 rounded-lg bg-zinc-800/50 p-4">
                  <StatusStepper currentStatus={invoice.status} />
                </div>

                {/* Metadata grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <Building2 className="h-3.5 w-3.5" />
                      AI Adapter
                    </div>
                    <p className="text-sm text-zinc-200">{formatProviderName(invoice.providerId)}</p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <User className="h-3.5 w-3.5" />
                      Uploader
                    </div>
                    <p className="text-sm text-zinc-200 truncate">
                      {invoice.uploaderEmail ?? invoice.uploaderId.slice(0, 8) + '…'}
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Validator
                    </div>
                    <p className="text-sm text-zinc-200 truncate">
                      {invoice.validatorEmail
                        ? invoice.validatorEmail
                        : invoice.validatorId
                          ? invoice.validatorId.slice(0, 8) + '…'
                          : <span className="text-zinc-600">Not yet assigned</span>
                      }
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-500/60" />
                      Approver
                    </div>
                    <p className="text-sm text-zinc-200 truncate">
                      {invoice.approverEmail
                        ? invoice.approverEmail
                        : invoice.approverId
                          ? invoice.approverId.slice(0, 8) + '…'
                          : <span className="text-zinc-600">Not yet assigned</span>
                      }
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <Upload className="h-3.5 w-3.5" />
                      Uploaded
                    </div>
                    <p className="text-sm text-zinc-200">
                      {(() => {
                        const d = new Date(invoice.createdAt);
                        return isValid(d) ? format(d, "MMM d, yyyy 'at' HH:mm") : '—';
                      })()}
                    </p>
                  </div>

                  {/* Extracted fields — shown when extractedData is available */}
                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <DollarSign className="h-3.5 w-3.5" />
                      Amount (extracted)
                    </div>
                    <p className="text-lg font-semibold text-zinc-100">
                      {formatAmount(invoice.extractedData?.total ?? null)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Invoice Date
                    </div>
                    <p className="text-sm text-zinc-200">
                      {invoice.extractedData?.fecha
                        ? invoice.extractedData.fecha
                        : invoice.date
                          ? format(new Date(invoice.date), 'MMM d, yyyy')
                          : '—'}
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <Hash className="h-3.5 w-3.5" />
                      Invoice Number
                    </div>
                    <p className="text-sm font-mono text-zinc-200">
                      {invoice.extractedData?.numeroFactura ?? '—'}
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <Receipt className="h-3.5 w-3.5" />
                      Vendor
                    </div>
                    <p className="text-sm text-zinc-200 truncate">
                      {invoice.extractedData?.nombreEmisor ?? '—'}
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-800/50 p-4">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                      <FileDigit className="h-3.5 w-3.5" />
                      Tax ID (NIF)
                    </div>
                    <p className="text-sm font-mono text-zinc-200">
                      {invoice.extractedData?.nifEmisor ?? '—'}
                    </p>
                  </div>

                  {invoice.extractedData?.baseImponible != null && (
                    <div className="rounded-lg bg-zinc-800/50 p-4">
                      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                        <DollarSign className="h-3.5 w-3.5" />
                        Base imponible
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">
                        {formatAmount(invoice.extractedData.baseImponible)}
                      </p>
                    </div>
                  )}

                  {(invoice.extractedData?.iva != null || invoice.extractedData?.ivaPorcentaje != null) && (
                    <div className="rounded-lg bg-zinc-800/50 p-4">
                      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                        <DollarSign className="h-3.5 w-3.5" />
                        VAT (IVA)
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">
                        {invoice.extractedData?.iva != null
                          ? formatAmount(invoice.extractedData.iva)
                          : '—'}
                        {invoice.extractedData?.ivaPorcentaje != null && (
                          <span className="ml-2 text-xs font-normal text-zinc-400">
                            ({invoice.extractedData.ivaPorcentaje} %)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Validator action: EXTRACTED → READY_FOR_VALIDATION */}
                {canSendToValidation && (
                  <div className="mt-6 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-cyan-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Ready for Validation</span>
                    </div>
                    <p className="mb-4 text-sm text-zinc-400">
                      This invoice has been extracted. Review the data above and send it for validation.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => sendToValidationMutation.mutate(invoiceId)}
                        disabled={sendToValidationMutation.isPending}
                        className="bg-cyan-600 text-white hover:bg-cyan-700"
                      >
                        {sendToValidationMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send to Validation
                      </Button>
                      {canRejectAtExtracted && (
                        <Button
                          variant="outline"
                          onClick={() => setRejectModalOpen(true)}
                          disabled={rejectMutation.isPending}
                          className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Validator action: READY_FOR_VALIDATION → READY_FOR_APPROVAL (or Reject) */}
                {canSendToApproval && (
                  <div className="mt-6 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-violet-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Ready to Send for Approval</span>
                    </div>
                    <p className="mb-4 text-sm text-zinc-400">
                      This invoice has been validated. You can add an optional note for the approver, or reject it.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setSendToApprovalModalOpen(true)}
                        disabled={sendToApprovalMutation.isPending}
                        className="bg-violet-600 text-white hover:bg-violet-700"
                      >
                        {sendToApprovalMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send to Approval
                      </Button>
                      {canRejectFromValidation && (
                        <Button
                          variant="outline"
                          onClick={() => setRejectModalOpen(true)}
                          disabled={rejectMutation.isPending}
                          className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Validation errors + retry */}
                {invoice.status === 'VALIDATION_FAILED' && (
                  <div className="mt-6 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Validation Failed</span>
                    </div>
                    {invoice.validationErrors && invoice.validationErrors.length > 0 ? (
                      <ul className="mb-4 space-y-1">
                        {invoice.validationErrors.map((err, i) => (
                          <li key={i} className="text-sm text-rose-300">• {err}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mb-4 text-sm text-rose-300">
                        This invoice failed validation. Please check the document and retry.
                      </p>
                    )}
                    {canRetry && (
                      <Button
                        onClick={() => retryMutation.mutate(invoiceId)}
                        disabled={retryMutation.isPending}
                        variant="outline"
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        {retryMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Retry Processing
                      </Button>
                    )}
                  </div>
                )}

                {/* Rejection reason */}
                {invoice.status === 'REJECTED' && invoice.rejectionReason && (
                  <div className="mt-6 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-rose-400">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">Rejected</span>
                    </div>
                    <p className="mb-2 text-sm text-rose-300">{invoice.rejectionReason}</p>
                    {(invoice.approverEmail ?? invoice.approverId) && (
                      <p className="text-xs text-rose-400/70">
                        Rejected by: {invoice.approverEmail ?? invoice.approverId!.slice(0, 8) + '…'}
                      </p>
                    )}
                  </div>
                )}

                {/* Approve/Reject buttons */}
                {canApprove && (
                  <div className="mt-6 flex gap-3">
                    <Button
                      onClick={() => setApproveDialogOpen(true)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-zinc-500">Invoice not found</div>
            )}
          </motion.div>

          {/* Notes — full form for validator/approver/admin; read-only for uploader */}
          {(canAddNote || isOwner) && (
            <InvoiceNotes invoiceId={invoiceId} readOnly={!canAddNote} />
          )}
        </div>

        {/* Right column - Event Timeline */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h3 className="mb-6 text-lg font-semibold tracking-tight text-zinc-50">
              Status History
            </h3>
            
            {isLoadingEvents ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <InvoiceEventTimeline events={events} />
            )}
          </motion.div>
        </div>
      </div>

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
          sendToApprovalMutation.mutate({ id: invoiceId, note });
          setSendToApprovalModalOpen(false);
        }}
        isLoading={sendToApprovalMutation.isPending}
      />
    </AppShell>
  );
}
