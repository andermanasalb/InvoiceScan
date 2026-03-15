import { Counter, Histogram, metrics } from '@opentelemetry/api';

/**
 * Centralised OTel metric instruments for invoice-flow-backend.
 *
 * All counters and histograms are created once here and exported as
 * singletons.  Import the specific instrument you need in your use case
 * or worker — do NOT create instruments ad-hoc to avoid duplicate
 * registrations that can cause SDK warnings.
 *
 * Naming convention:
 *   <domain>_<action>_<unit>   (snake_case, lowercase)
 *
 * Labels (attributes) are attached at record/add time, not here.
 */

const meter = metrics.getMeter('invoice-flow-backend', '1.0.0');

// ── Counters ──────────────────────────────────────────────────────────────

/**
 * Total invoices approved.
 * Attributes: { approverId: string }
 */
export const invoicesApprovedCounter: Counter = meter.createCounter(
  'invoices_approved_total',
  {
    description: 'Total number of invoices approved',
  },
);

/**
 * Total invoices rejected.
 * Attributes: { approverId: string }
 */
export const invoicesRejectedCounter: Counter = meter.createCounter(
  'invoices_rejected_total',
  {
    description: 'Total number of invoices rejected',
  },
);

/**
 * Total invoices processed (OCR + LLM pipeline completed).
 * Attributes: { status: 'success' | 'error' }
 */
export const invoicesProcessedCounter: Counter = meter.createCounter(
  'invoices_processed_total',
  {
    description: 'Total number of invoices through the OCR+LLM pipeline',
  },
);

/**
 * Total outbox events processed by the poller.
 * Attributes: { eventType: string }
 */
export const outboxEventsProcessedCounter: Counter = meter.createCounter(
  'outbox_events_processed_total',
  {
    description: 'Total number of outbox events processed by the poller',
  },
);

// ── Histograms ────────────────────────────────────────────────────────────

/**
 * Duration of the full OCR + LLM extraction pipeline in milliseconds.
 * Attributes: { status: 'success' | 'error' }
 */
export const ocrDurationHistogram: Histogram = meter.createHistogram(
  'ocr_duration_ms',
  {
    description: 'Duration of OCR + LLM extraction pipeline in milliseconds',
    unit: 'ms',
  },
);
