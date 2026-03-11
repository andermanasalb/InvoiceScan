import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/db/database.module';
import { InvoicesModule } from './invoices.module';

@Module({
  imports: [DatabaseModule, InvoicesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
