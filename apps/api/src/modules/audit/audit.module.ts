// AuditModule (@Global so any module can inject AuditService).
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]), UsersModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
