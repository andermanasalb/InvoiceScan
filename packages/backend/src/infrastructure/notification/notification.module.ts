import { Module } from '@nestjs/common';
import {
  NoOpNotificationAdapter,
  NOTIFICATION_TOKEN,
} from './no-op-notification.adapter';

/**
 * NotificationModule
 *
 * Registra el adaptador de notificaciones bajo NOTIFICATION_TOKEN.
 *
 * FASE 9 (ahora): NoOpNotificationAdapter — solo loguea, no envía emails.
 * FASE 11: cambiar useClass a NodemailerAdapter aquí. Nada más cambia.
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
