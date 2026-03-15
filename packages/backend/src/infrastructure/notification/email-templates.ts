import { InvoiceNotificationPayload } from '../../application/ports/notification.port';

interface TemplateResult {
  subject: string;
  html: string;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function formatAmount(amount?: number): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function noteSection(latestNote?: string): string {
  if (!latestNote) return '';
  return `
    <tr>
      <td style="padding:16px 0 0;">
        <div style="background:#f9f9f9;border-left:3px solid #6b7280;padding:12px 16px;border-radius:4px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Latest Note</p>
          <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(latestNote)}</p>
        </div>
      </td>
    </tr>`;
}

function rejectionSection(reason: string): string {
  return `
    <tr>
      <td style="padding:16px 0 0;">
        <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;border-radius:4px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#ef4444;text-transform:uppercase;letter-spacing:.05em;">Rejection Reason</p>
          <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(reason)}</p>
        </div>
      </td>
    </tr>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function invoiceDetails(payload: InvoiceNotificationPayload): string {
  return `
    <tr>
      <td style="padding:16px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:6px;padding:16px;">
          <tr>
            <td style="font-size:12px;color:#6b7280;padding:4px 0;">Invoice ID</td>
            <td style="font-size:12px;color:#111827;text-align:right;padding:4px 0;font-family:monospace;">${escapeHtml(payload.invoiceId)}</td>
          </tr>
          ${payload.invoiceNumber ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Invoice #</td><td style="font-size:12px;color:#111827;text-align:right;padding:4px 0;">${escapeHtml(payload.invoiceNumber)}</td></tr>` : ''}
          ${payload.vendorName ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Vendor</td><td style="font-size:12px;color:#111827;text-align:right;padding:4px 0;">${escapeHtml(payload.vendorName)}</td></tr>` : ''}
          <tr>
            <td style="font-size:12px;color:#6b7280;padding:4px 0;">Amount</td>
            <td style="font-size:12px;color:#111827;text-align:right;padding:4px 0;font-weight:600;">${formatAmount(payload.amount)}</td>
          </tr>
          ${payload.actorEmail ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0;">Actioned by</td><td style="font-size:12px;color:#111827;text-align:right;padding:4px 0;">${escapeHtml(payload.actorEmail)}</td></tr>` : ''}
        </table>
      </td>
    </tr>`;
}

function layout(
  title: string,
  badgeColor: string,
  badgeText: string,
  bodyRows: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:24px 32px;border-radius:8px 8px 0 0;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">InvoiceScan</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display:inline-block;background:${badgeColor};color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;">${badgeText}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;">${escapeHtml(title)}</h1>
                  </td>
                </tr>
                ${bodyRows}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;">
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">This is an automated notification from InvoiceScan. Do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * Uploader sent invoice to validation — notify the assigned validator.
 */
export function sentForValidationTemplate(
  payload: InvoiceNotificationPayload,
): TemplateResult {
  const bodyRows = `
    <tr>
      <td style="padding:8px 0 0;font-size:15px;color:#374151;">
        A new invoice has been submitted and is awaiting your review before it can proceed to approval.
      </td>
    </tr>
    ${invoiceDetails(payload)}
    ${noteSection(payload.latestNote)}`;

  return {
    subject: `Invoice ready for your review — ${payload.invoiceNumber ?? payload.invoiceId}`,
    html: layout(
      'New Invoice Awaiting Review',
      '#2563eb',
      'Needs Review',
      bodyRows,
    ),
  };
}

/**
 * Validator/approver who is also the uploader sent their own invoice to validation
 * — notify the assigned approver directly.
 */
export function sentForValidationSelfTemplate(
  payload: InvoiceNotificationPayload,
): TemplateResult {
  const bodyRows = `
    <tr>
      <td style="padding:8px 0 0;font-size:15px;color:#374151;">
        An invoice has been submitted for validation by a validator. It requires your review before approval.
      </td>
    </tr>
    ${invoiceDetails(payload)}
    ${noteSection(payload.latestNote)}`;

  return {
    subject: `Invoice requires your review — ${payload.invoiceNumber ?? payload.invoiceId}`,
    html: layout(
      'Invoice Requires Your Review',
      '#7c3aed',
      'Needs Review',
      bodyRows,
    ),
  };
}

/**
 * Invoice validated and sent to approval — notify the assigned approver.
 */
export function sentForApprovalTemplate(
  payload: InvoiceNotificationPayload,
): TemplateResult {
  const bodyRows = `
    <tr>
      <td style="padding:8px 0 0;font-size:15px;color:#374151;">
        An invoice has been validated and is ready for your approval.
      </td>
    </tr>
    ${invoiceDetails(payload)}
    ${noteSection(payload.latestNote)}`;

  return {
    subject: `Invoice ready for approval — ${payload.invoiceNumber ?? payload.invoiceId}`,
    html: layout(
      'Invoice Ready for Approval',
      '#d97706',
      'Pending Approval',
      bodyRows,
    ),
  };
}

/**
 * Invoice approved — notify uploader and validator.
 */
export function approvedTemplate(
  payload: InvoiceNotificationPayload,
): TemplateResult {
  const bodyRows = `
    <tr>
      <td style="padding:8px 0 0;font-size:15px;color:#374151;">
        Great news — the invoice has been reviewed and approved.
      </td>
    </tr>
    ${invoiceDetails(payload)}
    ${noteSection(payload.latestNote)}`;

  return {
    subject: `Invoice approved — ${payload.invoiceNumber ?? payload.invoiceId}`,
    html: layout('Invoice Approved', '#16a34a', 'Approved', bodyRows),
  };
}

/**
 * Invoice rejected — notify uploader and validator.
 * Rejection reason is always shown prominently.
 */
export function rejectedTemplate(
  payload: InvoiceNotificationPayload,
): TemplateResult {
  const reason = payload.rejectionReason ?? 'No reason provided.';
  const bodyRows = `
    <tr>
      <td style="padding:8px 0 0;font-size:15px;color:#374151;">
        The invoice has been reviewed and rejected. Please see the reason below.
      </td>
    </tr>
    ${rejectionSection(reason)}
    ${invoiceDetails(payload)}
    ${noteSection(payload.latestNote)}`;

  return {
    subject: `Invoice rejected — ${payload.invoiceNumber ?? payload.invoiceId}`,
    html: layout('Invoice Rejected', '#dc2626', 'Rejected', bodyRows),
  };
}
