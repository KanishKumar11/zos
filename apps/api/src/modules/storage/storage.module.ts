// Global storage module — exposes StorageService to other modules (payslips, invoices, sow).
import { Global, Module } from '@nestjs/common';

import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
