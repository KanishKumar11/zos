// DashboardService — owner & member metrics aggregations.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { InvoiceStatus, LeaveStatus, TaskStatus } from '@agency/shared';

import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import {
  LeaveRequest,
  type LeaveRequestDocument,
} from '../leaves/schemas/leave-request.schema';
import {
  PayrollRun,
  type PayrollRunDocument,
} from '../payroll/schemas/payroll-run.schema';
import { Payslip, type PayslipDocument } from '../payroll/schemas/payslip.schema';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { Sow, type SowDocument } from '../sow/schemas/sow.schema';
import { Task, type TaskDocument } from '../tasks/schemas/task.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(Sow.name) private readonly sows: Model<SowDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(PayrollRun.name) private readonly runs: Model<PayrollRunDocument>,
    @InjectModel(Payslip.name) private readonly payslips: Model<PayslipDocument>,
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
    @InjectModel(LeaveRequest.name) private readonly leaves: Model<LeaveRequestDocument>,
  ) {}

  async owner() {
    const [activeProjects, activeSows, invoiceAgg, lastRun] = await Promise.all([
      this.projects.countDocuments({ deletedAt: { $exists: false }, status: 'ACTIVE' }),
      this.sows.countDocuments({ deletedAt: { $exists: false } }),
      this.invoices
        .aggregate([
          { $match: { deletedAt: { $exists: false } } },
          {
            $group: {
              _id: '$status',
              total: { $sum: '$totalPaise' },
              paid: { $sum: '$paidPaise' },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.runs.findOne({ status: 'FINALIZED' }).sort({ month: -1 }).exec(),
    ]);

    const byStatus = Object.fromEntries(
      (
        invoiceAgg as Array<{
          _id: InvoiceStatus;
          total: number;
          paid: number;
          count: number;
        }>
      ).map((r) => [r._id, r]),
    ) as unknown as Partial<Record<InvoiceStatus, { total: number; paid: number; count: number }>>;

    const overdue = byStatus[InvoiceStatus.OVERDUE]?.total ?? 0;
    const outstanding =
      (byStatus[InvoiceStatus.SENT]?.total ?? 0) +
      (byStatus[InvoiceStatus.PARTIAL]?.total ?? 0) +
      overdue -
      ((byStatus[InvoiceStatus.SENT]?.paid ?? 0) +
        (byStatus[InvoiceStatus.PARTIAL]?.paid ?? 0) +
        (byStatus[InvoiceStatus.OVERDUE]?.paid ?? 0));
    const collected = byStatus[InvoiceStatus.PAID]?.paid ?? 0;

    return {
      activeProjects,
      activeSows,
      invoices: { outstanding, overdue, collected, byStatus },
      lastPayrollRun: lastRun
        ? {
            month: lastRun.month,
            totalNetPaise: lastRun.totalNetPaise,
            employeeCount: lastRun.employeeCount,
          }
        : null,
    };
  }

  async member(userId: string) {
    const [openTasks, pendingLeaves, lastPayslip] = await Promise.all([
      this.tasks.countDocuments({
        assigneeId: new Types.ObjectId(userId),
        status: { $in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
        deletedAt: { $exists: false },
      }),
      this.leaves.countDocuments({
        userId: new Types.ObjectId(userId),
        status: LeaveStatus.PENDING,
      }),
      this.payslips.findOne({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec(),
    ]);
    return {
      openTasks,
      pendingLeaves,
      lastPayslip: lastPayslip
        ? { netPaise: lastPayslip.netPaise, runId: lastPayslip.runId.toString() }
        : null,
    };
  }
}
