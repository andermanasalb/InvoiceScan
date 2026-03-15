import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendAdapter } from '../resend.adapter';
import type { InvoiceNotificationPayload } from '../../../application/ports/notification.port';

// ---------------------------------------------------------------------------
// Mock the Resend SDK so no real HTTP calls are made
// vi.hoisted is required because vi.mock factories are hoisted to the top of
// the file by Vitest — any variable they reference must also be hoisted.
// ---------------------------------------------------------------------------

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_KEY = 'test-api-key';
const FROM = 'InvoiceScan <no-reply@example.com>';

function makeAdapter(): ResendAdapter {
  return new ResendAdapter(API_KEY, FROM);
}

function makePayload(
  overrides?: Partial<InvoiceNotificationPayload>,
): InvoiceNotificationPayload {
  return {
    eventType: 'approved',
    invoiceId: 'inv-123',
    toEmails: ['uploader@example.com'],
    invoiceNumber: 'INV-001',
    vendorName: 'Acme Corp',
    amount: 1500,
    actorEmail: 'approver@example.com',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResendAdapter', () => {
  let adapter: ResendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = makeAdapter();
  });

  describe('notifyStatusChange', () => {
    it('should call resend.emails.send once per recipient', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-id-1' }, error: null });

      await adapter.notifyStatusChange(
        makePayload({ toEmails: ['a@example.com', 'b@example.com'] }),
      );

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should send from the configured fromEmail address', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-id-1' }, error: null });

      await adapter.notifyStatusChange(makePayload());

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: FROM }),
      );
    });

    it('should set an idempotency key header per recipient', async () => {
      mockSend.mockResolvedValue({ data: { id: 'id' }, error: null });

      const payload = makePayload({ toEmails: ['user@example.com'] });
      await adapter.notifyStatusChange(payload);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'X-Entity-Ref-ID': `approved/inv-123/user@example.com`,
          },
        }),
      );
    });

    it('should not throw when resend returns an error', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'rate limited' },
      });

      await expect(
        adapter.notifyStatusChange(makePayload()),
      ).resolves.toBeUndefined();
    });

    it('should return early and not call send when toEmails is empty', async () => {
      await adapter.notifyStatusChange(makePayload({ toEmails: [] }));

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should send the correct subject for the approved event', async () => {
      mockSend.mockResolvedValue({ data: { id: 'id' }, error: null });

      await adapter.notifyStatusChange(
        makePayload({ eventType: 'approved', invoiceNumber: 'INV-042' }),
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Invoice approved — INV-042' }),
      );
    });

    it('should send the correct subject for the rejected event', async () => {
      mockSend.mockResolvedValue({ data: { id: 'id' }, error: null });

      await adapter.notifyStatusChange(
        makePayload({
          eventType: 'rejected',
          invoiceNumber: 'INV-042',
          rejectionReason: 'Missing VAT',
        }),
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Invoice rejected — INV-042' }),
      );
    });

    it('should use invoiceId in subject when invoiceNumber is absent', async () => {
      mockSend.mockResolvedValue({ data: { id: 'id' }, error: null });

      await adapter.notifyStatusChange(
        makePayload({ eventType: 'approved', invoiceNumber: undefined }),
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Invoice approved — inv-123' }),
      );
    });

    it('should send html in the email body', async () => {
      mockSend.mockResolvedValue({ data: { id: 'id' }, error: null });

      await adapter.notifyStatusChange(makePayload());

      const call = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(typeof call.html).toBe('string');
      expect((call.html as string).length).toBeGreaterThan(0);
    });

    it('should continue sending to remaining recipients after one fails', async () => {
      mockSend
        .mockResolvedValueOnce({ data: null, error: { message: 'failed' } })
        .mockResolvedValueOnce({ data: { id: 'id-2' }, error: null });

      await adapter.notifyStatusChange(
        makePayload({ toEmails: ['fail@example.com', 'ok@example.com'] }),
      );

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
