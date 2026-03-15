import { Module } from '@nestjs/common';
import { NoOpNotificationAdapter } from './no-op-notification.adapter';
import { NOTIFICATION_TOKEN } from '../events/handlers/invoice-approved.handler';

/**
 * NotificationModule
 *
 * Registers the notification adapter under NOTIFICATION_TOKEN.
 *
 * FASE 9 (now): NoOpNotificationAdapter — logs only, no emails sent.
 * FASE 11: swap useClass to NodemailerAdapter here. Nothing else changes.
 */
@Module({
  providers: [
    {
      provide: NOTIFICATION_TOKEN,
      useClass: NoOpNotificationAdapter,
    },
  ],
  exports: [NOTIFICATION_TOKEN],
})
export class NotificationModule {}
