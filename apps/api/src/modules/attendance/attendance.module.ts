// AttendanceModule.
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceEntry, AttendanceEntrySchema } from './schemas/attendance-entry.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AttendanceEntry.name, schema: AttendanceEntrySchema }]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
