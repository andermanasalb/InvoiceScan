import { describe, it, expect } from 'vitest';
import {
  sentForValidationTemplate,
  sentForValidationSelfTemplate,
  sentForApprovalTemplate,
  approvedTemplate,
  rejectedTemplate,
} from '../email-templates';
import type { InvoiceNotificationPayload } from '../../../application/ports/notification.port';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(
  overrides?: Partial<InvoiceNotificationPayload>,
): InvoiceNotificationPayload {
  return {
    eventType: 'approved',
    invoiceId: 'inv-tpl-001',
    toEmails: ['user@example.com'],
    invoiceNumber: 'INV-042',
    vendorName: 'Acme Corp',
    amount: 1234.56,
    actorEmail: 'actor@example.com',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('email-templates', () => {
  describe('sentForValidationTemplate', () => {
    it('should return a subject containing the invoice number', () => {
      const { subject } = sentForValidationTemplate(makePayload());
      expect(subject).toContain('INV-042');
    });

    it('should fall back to invoiceId in subject when invoiceNumber is absent', () => {
      const { subject } = sentForValidationTemplate(
        makePayload({ invoiceNumber: undefined }),
      );
      expect(subject).toContain('inv-tpl-001');
    });

    it('should produce valid HTML containing the vendor name', () => {
      const { html } = sentForValidationTemplate(makePayload());
      expect(html).toContain('Acme Corp');
    });

    it('should include the actorEmail in the html', () => {
      const { html } = sentForValidationTemplate(makePayload());
      expect(html).toContain('actor@example.com');
    });

    it('should include the latest note section when a note is provided', () => {
      const { html } = sentForValidationTemplate(
        makePayload({ latestNote: 'Please review line 3' }),
      );
      expect(html).toContain('Please review line 3');
      expect(html).toContain('Latest Note');
    });

    it('should not include a note section when no note is provided', () => {
      const { html } = sentForValidationTemplate(
        makePayload({ latestNote: undefined }),
      );
      expect(html).not.toContain('Latest Note');
    });

    it('should escape HTML special characters in vendor name', () => {
      const { html } = sentForValidationTemplate(
        makePayload({ vendorName: '<script>alert(1)</script>' }),
      );
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('sentForValidationSelfTemplate', () => {
    it('should return a subject indicating approval review', () => {
      const { subject } = sentForValidationSelfTemplate(makePayload());
      expect(subject).toContain('INV-042');
    });

    it('should produce valid HTML', () => {
      const { html } = sentForValidationSelfTemplate(makePayload());
      expect(html).toContain('<!DOCTYPE html>');
      expect(html.length).toBeGreaterThan(100);
    });
  });

  describe('sentForApprovalTemplate', () => {
    it('should return a subject containing the invoice number', () => {
      const { subject } = sentForApprovalTemplate(makePayload());
      expect(subject).toContain('INV-042');
    });

    it('should mention pending approval in the html', () => {
      const { html } = sentForApprovalTemplate(makePayload());
      expect(html).toContain('Pending Approval');
    });

    it('should include a note section when a note is provided', () => {
      const { html } = sentForApprovalTemplate(
        makePayload({ latestNote: 'Validated and ready' }),
      );
      expect(html).toContain('Validated and ready');
    });
  });

  describe('approvedTemplate', () => {
    it('should return a subject containing the word approved', () => {
      const { subject } = approvedTemplate(makePayload());
      expect(subject.toLowerCase()).toContain('approved');
    });

    it('should include invoice number in subject', () => {
      const { subject } = approvedTemplate(makePayload());
      expect(subject).toContain('INV-042');
    });

    it('should include the Approved badge in html', () => {
      const { html } = approvedTemplate(makePayload());
      expect(html).toContain('Approved');
    });

    it('should include the formatted amount in html', () => {
      const { html } = approvedTemplate(makePayload({ amount: 1234.56 }));
      // Intl.NumberFormat es-ES formats 1234.56 as "1234,56 €" or "1.234,56 €"
      // depending on the Node.js ICU data — just verify a recognizable portion
      expect(html).toContain('1234');
    });

    it('should render em dash when amount is missing', () => {
      const { html } = approvedTemplate(makePayload({ amount: undefined }));
      expect(html).toContain('—');
    });

    it('should escape HTML special characters in latestNote', () => {
      const { html } = approvedTemplate(
        makePayload({ latestNote: '<b>bold</b>' }),
      );
      expect(html).not.toContain('<b>bold</b>');
      expect(html).toContain('&lt;b&gt;');
    });
  });

  describe('rejectedTemplate', () => {
    it('should return a subject containing the word rejected', () => {
      const { subject } = rejectedTemplate(
        makePayload({ rejectionReason: 'Wrong amount' }),
      );
      expect(subject.toLowerCase()).toContain('rejected');
    });

    it('should include the rejection reason in html', () => {
      const { html } = rejectedTemplate(
        makePayload({ rejectionReason: 'Missing VAT number' }),
      );
      expect(html).toContain('Missing VAT number');
    });

    it('should include Rejection Reason label in html', () => {
      const { html } = rejectedTemplate(
        makePayload({ rejectionReason: 'Bad data' }),
      );
      expect(html).toContain('Rejection Reason');
    });

    it('should fall back to "No reason provided." when rejectionReason is absent', () => {
      const { html } = rejectedTemplate(
        makePayload({ rejectionReason: undefined }),
      );
      expect(html).toContain('No reason provided.');
    });

    it('should escape HTML special characters in rejection reason', () => {
      const { html } = rejectedTemplate(
        makePayload({ rejectionReason: '<script>evil()</script>' }),
      );
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should include both note and rejection sections when both are present', () => {
      const { html } = rejectedTemplate(
        makePayload({
          rejectionReason: 'Duplicate invoice',
          latestNote: 'Already processed in Jan',
        }),
      );
      expect(html).toContain('Duplicate invoice');
      expect(html).toContain('Already processed in Jan');
      expect(html).toContain('Rejection Reason');
      expect(html).toContain('Latest Note');
    });
  });
});
