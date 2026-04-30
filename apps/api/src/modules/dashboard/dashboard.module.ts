// DashboardModule — registers required model handles for aggregations.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import {
  LeaveRequest,
  LeaveRequestSchema,
} from '../leaves/schemas/leave-request.schema';
import {
  PayrollRun,
  PayrollRunSchema,
} from '../payroll/schemas/payroll-run.schema';
import { Payslip, PayslipSchema } from '../payroll/schemas/payslip.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Sow, SowSchema } from '../sow/schemas/sow.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Sow.name, schema: SowSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: PayrollRun.name, schema: PayrollRunSchema },
      { name: Payslip.name, schema: PayslipSchema },
      { name: Task.name, schema: TaskSchema },
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
