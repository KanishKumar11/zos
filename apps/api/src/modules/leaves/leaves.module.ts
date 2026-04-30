// LeavesModule.
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeaveBalance, LeaveBalanceSchema } from './schemas/leave-balance.schema';
import { LeaveRequest, LeaveRequestSchema } from './schemas/leave-request.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
      { name: LeaveBalance.name, schema: LeaveBalanceSchema },
    ]),
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
