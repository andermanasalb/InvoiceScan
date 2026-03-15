import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ResendAdapter } from './resend.adapter';
import { NOTIFICATION_TOKEN } from '../events/handlers/invoice-approved.handler';

/**
 * NotificationModule
 *
 * Registers the ResendAdapter under NOTIFICATION_TOKEN.
 * RESEND_API_KEY and RESEND_FROM_EMAIL are read from ConfigService.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: NOTIFICATION_TOKEN,
      useFactory: (config: ConfigService): ResendAdapter =>
        new ResendAdapter(
          config.getOrThrow<string>('RESEND_API_KEY'),
          config.get<string>('RESEND_FROM_EMAIL') ??
            'InvoiceScan <onboarding@resend.dev>',
        ),
      inject: [ConfigService],
    },
  ],
  exports: [NOTIFICATION_TOKEN],
})
export class NotificationModule {}
