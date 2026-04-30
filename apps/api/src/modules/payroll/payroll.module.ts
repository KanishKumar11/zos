// PayrollModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollRun, PayrollRunSchema } from './schemas/payroll-run.schema';
import { Payslip, PayslipSchema } from './schemas/payslip.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PayrollRun.name, schema: PayrollRunSchema },
      { name: Payslip.name, schema: PayslipSchema },
    ]),
    UsersModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
