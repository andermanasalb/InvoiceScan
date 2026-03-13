import { Module } from '@nestjs/common';
import {
  LocalStorageAdapter,
  STORAGE_TOKEN,
} from './local-storage.adapter';

/**
 * StorageModule
 *
 * Registers LocalStorageAdapter under the STORAGE_TOKEN injection token.
 * Any module that imports StorageModule can then inject the adapter using:
 *
 *   @Inject(STORAGE_TOKEN) private readonly storage: StoragePort
 *
 * To switch to S3 in production, only this file changes — every consumer
 * of STORAGE_TOKEN keeps working without modification.
 */
@Module({
  providers: [
    {
      provide: STORAGE_TOKEN,
      useFactory: () => new LocalStorageAdapter(),
    },
  ],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
