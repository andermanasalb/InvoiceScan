'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Eye, CheckCircle2, XCircle, Send } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { CopyableId } from '@/components/ui/copyable-id';
import { staggerContainer, staggerItem } from '@/components/layout/page-transition';
import type { Invoice, UserRole } from '@/types/invoice';
import { formatProviderName } from '@/types/invoice';

interface InvoiceTableProps {
  invoices: Invoice[];
  userRole?: UserRole | null;
  userId?: string | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onSendToApproval?: (id: string) => void;
  onSendToValidation?: (id: string) => void;
  isApproving?: boolean;
  isSendingToApproval?: boolean;
  isSendingToValidation?: boolean;
}

export function InvoiceTable({ 
  invoices, 
  userRole,
  userId,
  onApprove, 
  onReject,
  onSendToApproval,
  onSendToValidation,
  isApproving,
  isSendingToApproval,
  isSendingToValidation,
}: InvoiceTableProps) {
  const router = useRouter();

  // Role-level capability (regardless of ownership)
  const roleCanApprove = userRole === 'approver' || userRole === 'admin';
  const roleCanSendToApproval = userRole === 'approver' || userRole === 'admin';
  const roleCanSendToValidation =
    userRole === 'uploader' ||
    userRole === 'validator' ||
    userRole === 'approver' ||
    userRole === 'admin';
  const isAdmin = userRole === 'admin';

  const formatAmount = (amount: number | undefined) => {
    if (!amount || amount === 0) return '—';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleRowClick = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="w-12 text-zinc-500">#</TableHead>
            <TableHead className="text-zinc-500">Invoice ID</TableHead>
            <TableHead className="text-zinc-500">Provider</TableHead>
            <TableHead className="text-zinc-500">Status</TableHead>
            <TableHead className="text-zinc-500">Amount</TableHead>
            <TableHead className="text-zinc-500">Date</TableHead>
            <TableHead className="text-zinc-500">Uploaded</TableHead>
            <TableHead className="text-right text-zinc-500">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <motion.tbody
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {invoices.map((invoice, index) => {
            // Per-row ownership checks
            const isOwner = !!userId && invoice.uploaderId === userId;
            const isValidator = invoice.validatorId === userId;

            // Uploader can send their OWN invoices to validation (they review AI data first)
            // Validator/approver/admin can send any invoice they don't own
            const canSendToValidation = roleCanSendToValidation && (
              isAdmin ||
              (userRole === 'uploader' && isOwner) ||
              (userRole !== 'uploader' && !isOwner)
            );
            // Send-to-approval: approver/admin only, cannot be the validator who submitted
            const canSendToApproval = roleCanSendToApproval && (isAdmin || (!isOwner && !isValidator));
            const canApprove = roleCanApprove && (isAdmin || (!isOwner && !isValidator));

            return (
            <motion.tr
              key={invoice.invoiceId}
              variants={staggerItem}
              onClick={() => handleRowClick(invoice.invoiceId)}
              className="cursor-pointer border-zinc-800/50 transition-colors hover:bg-zinc-800/50"
            >
              <TableCell className="font-mono text-xs text-zinc-600">
                {index + 1}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <CopyableId id={invoice.invoiceId} className="mt-1" />
              </TableCell>
              <TableCell className="text-zinc-300 text-xs">
                {formatProviderName(invoice.providerId)}
              </TableCell>
              <TableCell>
                <StatusBadge status={invoice.status} size="sm" />
              </TableCell>
              <TableCell className="font-medium text-zinc-300">
                {formatAmount(invoice.amount)}
              </TableCell>
              <TableCell className="text-zinc-400">
                {invoice.date ? format(new Date(invoice.date), 'MMM d, yyyy') : '—'}
              </TableCell>
              <TableCell className="text-zinc-500">
                {formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  {canSendToValidation && invoice.status === 'EXTRACTED' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSendToValidation?.(invoice.invoiceId)}
                      disabled={isSendingToValidation}
                      className="h-8 gap-1 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send to Validation
                    </Button>
                  )}
                  {canSendToApproval && invoice.status === 'READY_FOR_VALIDATION' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSendToApproval?.(invoice.invoiceId)}
                      disabled={isSendingToApproval}
                      className="h-8 gap-1 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send to Approval
                    </Button>
                  )}
                  {canApprove && invoice.status === 'READY_FOR_APPROVAL' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onApprove?.(invoice.invoiceId)}
                        disabled={isApproving}
                        className="h-8 gap-1 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onReject?.(invoice.invoiceId)}
                        disabled={isApproving}
                        className="h-8 gap-1 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleRowClick(invoice.invoiceId)}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </motion.tr>
            );
          })}
        </motion.tbody>
      </Table>
    </div>
  );
}
