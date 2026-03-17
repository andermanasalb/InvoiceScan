/**
 * AppModule — módulo raíz de la aplicación NestJS.
 *
 * Responsabilidades:
 * - Registrar guards globales (JwtAuthGuard → RolesGuard, en ese orden).
 * - Importar módulos de infraestructura transversal: ConfigModule, BullMQ,
 *   EventEmitter y DatabaseModule.
 * - Montar Bull Board UI de monitoreo de colas SOLO en entornos no-producción.
 * - Configurar nestjs-pino como logger global con traceId propagado via OTel.
 *
 * Nota sobre el orden de guards:
 *   JwtAuthGuard corre primero (pobla request.user desde el JWT).
 *   RolesGuard corre segundo (verifica request.user.role contra @Roles()).
 *   Si se invirtiese el orden, RolesGuard no tendría usuario que comprobar.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { trace } from '@opentelemetry/api';
import { DatabaseModule } from './infrastructure/db/database.module';
import { InvoicesModule } from './invoices.module';
import { AdminModule } from './admin.module';
import { ExportsModule } from './exports.module';
import { JobsModule } from './interface/jobs/jobs.module';
import { AuthModule } from './interface/auth.module';
import { HealthController } from './interface/http/controllers/health.controller';
import { JwtAuthGuard } from './interface/http/guards/jwt-auth.guard';
import { RolesGuard } from './interface/http/guards/roles.guard';
import { validateConfig } from './shared/config/config.schema';
import { PROCESS_INVOICE_QUEUE } from './infrastructure/queue/invoice-queue.service';
import { EXPORT_INVOICE_QUEUE } from './infrastructure/queue/export-queue.service';

const config = validateConfig();

const redisUrl = new URL(config.REDIS_URL);

/**
 * Bull Board solo se monta fuera de producción.
 * En producción la ruta /admin/queues no existe — no hay superficie de ataque.
 */
const bullBoardModules =
  config.NODE_ENV !== 'production'
    ? [
        BullBoardModule.forRoot({
          route: '/admin/queues',
          adapter: ExpressAdapter,
        }),
        BullBoardModule.forFeature({
          name: PROCESS_INVOICE_QUEUE,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: EXPORT_INVOICE_QUEUE,
          adapter: BullMQAdapter,
        }),
      ]
    : [];

@Module({
  imports: [
    // ConfigService disponible globalmente (JwtStrategy, AIStudioAdapter, etc.)
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Structured JSON logger with OTel traceId propagation ──────────────
    // In production: JSON output with traceId/spanId injected automatically.
    // In development: pretty-printed output for readability.
    // PinoLogger replaces the built-in NestJS Logger in all classes.
    LoggerModule.forRoot({
      pinoHttp: {
        level: config.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          config.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        // Inject OTel traceId + spanId into every log record
        mixin() {
          const activeSpan = trace.getActiveSpan();
          if (!activeSpan) return {};
          const ctx = activeSpan.spanContext();
          return {
            traceId: ctx.traceId,
            spanId: ctx.spanId,
          };
        },
        autoLogging: {
          ignore: (req) => (req as { url?: string }).url === '/api/v1/health',
        },
        serializers: {
          req(req: { method: string; url: string }) {
            return { method: req.method, url: req.url };
          },
        },
      },
    }),

    // Bus de eventos in-process. Los handlers (@OnEvent) escuchan aquí.
    // El OutboxPollerWorker emite aquí tras leer outbox_events.
    EventEmitterModule.forRoot(),

    // Configuración global de Redis para BullMQ
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        ...(redisUrl.password && { password: decodeURIComponent(redisUrl.password) }),
        ...(redisUrl.username && { username: redisUrl.username }),
      },
    }),

    // Bull Board UI — solo activo fuera de producción
    ...bullBoardModules,

    DatabaseModule,
    InvoicesModule,
    AdminModule,
    ExportsModule,
    JobsModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // JwtAuthGuard runs first globally — populates request.user from the JWT.
    // RolesGuard runs second — checks request.user.role against @Roles().
    // Order matters: JWT must validate before roles can be checked.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
