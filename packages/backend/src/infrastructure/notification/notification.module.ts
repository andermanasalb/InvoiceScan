import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ResendAdapter } from './resend.adapter';
import { NOTIFICATION_TOKEN } from '../events/handlers/invoice-approved.handler';
import type { NotificationPort } from '../../application/ports/notification.port';

/**
 * NotificationModule
 *
 * Registers the appropriate NotificationPort implementation:
 *   - ResendAdapter when RESEND_API_KEY is configured (production).
 *   - A lightweight no-op logger when the key is absent (dev / CI without email).
 *
 * Using a no-op inline object instead of NoOpNotificationAdapter class to
 * avoid NestJS DI complexity (the class requires @InjectPinoLogger which
 * is not available at useFactory time without extra injection tokens).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: NOTIFICATION_TOKEN,
      useFactory: (config: ConfigService): NotificationPort => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        const fromEmail =
          config.get<string>('RESEND_FROM_EMAIL') ??
          'InvoiceScan <onboarding@resend.dev>';

        if (apiKey) {
          return new ResendAdapter(apiKey, fromEmail);
        }

        // No API key — return a no-op adapter that logs at debug level.
        const logger = new Logger('NoOpNotificationAdapter');
        return {
          notifyStatusChange: (payload) => {
            logger.debug(
              `No-op notification: ${payload.eventType} for invoice ${payload.invoiceId}`,
            );
            return Promise.resolve();
          },
        };
      },
      inject: [ConfigService],
    },
  ],
  exports: [NOTIFICATION_TOKEN],
})
export class NotificationModule {}
