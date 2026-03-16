// OTel SDK MUST be the first import — patches modules at load time.
// No-op when OTEL_EXPORTER_OTLP_ENDPOINT is not set.
import './tracing';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateConfig } from './shared/config/config.schema';
import { DomainErrorFilter } from './interface/http/filters/domain-error.filter';

async function bootstrap() {
  const config = validateConfig();
  const app = await NestFactory.create(AppModule);

  // ── Security HTTP headers ─────────────────────────────────────────────────
  // Explicit CSP to prevent XSS even if the frontend accidentally injects
  // unsafe content. script-src 'self' blocks inline scripts.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // inline styles needed by some clients
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // keep disabled — API is consumed cross-origin
    }),
  );

  // ── CORS — only allow the explicitly configured frontend origin ───────────
  // No fallback to a hardcoded origin in production: if FRONTEND_URL is missing
  // the app would have already exited in validateConfig() above.
  app.enableCors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Cookie parser (required for HttpOnly refresh token) ──────────────────
  app.use(cookieParser());

  // ── Global exception filter — maps DomainErrors to correct HTTP status ───
  app.useGlobalFilters(new DomainErrorFilter());

  await app.listen(config.PORT);
}
void bootstrap();
