import { z } from 'zod';

export const UploadInvoiceInputSchema = z.object({
  uploaderId: z.string().uuid(),
  providerId: z.string().uuid(),
  fileBuffer: z.instanceof(Buffer),
  mimeType: z.string().refine((v) => v === 'application/pdf', {
    message: 'Only PDF files are allowed',
  }),
  fileSizeBytes: z.number().max(10 * 1024 * 1024, {
    message: 'File size must not exceed 10MB',
  }),
});
export type UploadInvoiceInput = z.infer<typeof UploadInvoiceInputSchema>;

export const UploadInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  filePath: z.string(),
  uploaderId: z.string(),
  providerId: z.string(),
  createdAt: z.date(),
});
export type UploadInvoiceOutput = z.infer<typeof UploadInvoiceOutputSchema>;
