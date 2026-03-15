import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry SDK setup — must be imported FIRST in main.ts before any
 * other imports so auto-instrumentation patches modules at load time.
 *
 * Design decisions:
 * - No-op when OTEL_EXPORTER_OTLP_ENDPOINT is not set (dev without collector).
 * - Exports to the OTLP/HTTP endpoint (works with SigNoz, Jaeger, etc.).
 * - Metrics are exported every 10 seconds.
 * - Service name defaults to 'invoice-flow-backend' but can be overridden
 *   via the OTEL_SERVICE_NAME env var.
 *
 * SigNoz local dev:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *   OTEL_SERVICE_NAME=invoice-flow-backend
 */

const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'invoice-flow-backend';

let sdk: NodeSDK | null = null;

if (endpoint) {
  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // File system instrumentation is very noisy — disable it
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    void sdk!.shutdown().finally(() => process.exit(0));
  });
} else {
  // No collector configured — use no-op tracer (API already provides it by default)
  // The @opentelemetry/api package returns a no-op tracer when no SDK is registered,
  // so all trace/span calls in the application are safe to call regardless.
}

export { sdk };
