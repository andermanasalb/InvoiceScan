import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/db/database.module';
import { InvoicesModule } from './invoices.module';
import { JobsModule } from './interface/jobs/jobs.module';
import { AuthModule } from './interface/auth.module';
import { validateConfig } from './shared/config/config.schema';
import { PROCESS_INVOICE_QUEUE } from './infrastructure/queue/invoice-queue.service';

const config = validateConfig();

// Parseamos REDIS_URL → host + port para BullMQ
// Formato esperado: redis://localhost:6379
const redisUrl = new URL(config.REDIS_URL);

@Module({
  imports: [
    // Make ConfigService available for injection everywhere (e.g. JwtStrategy, AIStudioAdapter)
    ConfigModule.forRoot({ isGlobal: true }),

    // Configuración global de Redis para BullMQ
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
      },
    }),

    // Bull Board — UI de monitoreo de colas
    // Solo activo en desarrollo: en producción no se monta el router
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: PROCESS_INVOICE_QUEUE,
      adapter: BullMQAdapter,
    }),

    DatabaseModule,
    InvoicesModule,
    JobsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
