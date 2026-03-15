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
  validateConfig();
  const app = await NestFactory.create(AppModule);

  // ── Security HTTP headers ────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS — only allow the configured frontend origin ─────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // ── Cookie parser (required for HttpOnly refresh token) ──────────────────
  app.use(cookieParser());

  // ── Global exception filter — maps DomainErrors to correct HTTP status ───
  app.useGlobalFilters(new DomainErrorFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
