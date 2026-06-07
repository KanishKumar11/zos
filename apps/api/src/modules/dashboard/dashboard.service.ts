// DashboardService — owner & member metrics aggregations.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { InvoiceStatus, LeaveStatus, TaskStatus } from '@agency/shared';

import { Expense, type ExpenseDocument } from '../expenses/schemas/expense.schema';
import {
  FreelancerPayment,
  type FreelancerPaymentDocument,
} from '../freelancer-payments/schemas/freelancer-payment.schema';
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
import { User, type UserDocument } from '../users/schemas/user.schema';

/** Build a sorted list of the last N YYYY-MM strings ending at current month. */
function lastNMonths(n: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

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
    @InjectModel(Expense.name) private readonly expenses: Model<ExpenseDocument>,
    @InjectModel(FreelancerPayment.name)
    private readonly freelancerPayments: Model<FreelancerPaymentDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
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
            memberCount: lastRun.employeeCount,
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

  async ownerCharts() {
    const months = lastNMonths(12);
    const startDate = new Date(`${months[0]}-01`);

    const [revenueAgg, payrollAgg, expenseAgg, freelancerAgg] = await Promise.all([
      // Monthly collected revenue — unwind payment entries on invoices
      this.invoices
        .aggregate([
          { $match: { deletedAt: { $exists: false } } },
          { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
          { $match: { 'payments.paidAt': { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$payments.paidAt' } },
              collectedPaise: { $sum: '$payments.amountPaise' },
            },
          },
        ])
        .exec(),
      // Monthly payroll totals
      this.runs
        .aggregate([
          { $match: { status: 'FINALIZED', month: { $gte: months[0] } } },
          {
            $group: {
              _id: '$month',
              totalNetPaise: { $sum: '$totalNetPaise' },
              memberCount: { $sum: '$employeeCount' },
            },
          },
        ])
        .exec(),
      // Monthly expenses
      this.expenses
        .aggregate([
          { $match: { deletedAt: { $exists: false }, date: { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
              totalPaise: { $sum: '$amountPaise' },
            },
          },
        ])
        .exec(),
      // Monthly freelancer payments — unwind payment entries
      this.freelancerPayments
        .aggregate([
          { $match: { deletedAt: { $exists: false } } },
          { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
          { $match: { 'payments.date': { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$payments.date' } },
              totalPaise: { $sum: '$payments.amountPaise' },
            },
          },
        ])
        .exec(),
    ]);

    const toMap = <T extends { _id: string }>(arr: T[]) =>
      new Map(arr.map((r) => [r._id, r]));

    type RevRow = { _id: string; collectedPaise: number };
    type PayRow = { _id: string; totalNetPaise: number; memberCount: number };
    type ExpRow = { _id: string; totalPaise: number };

    const revMap = toMap(revenueAgg as RevRow[]);
    const payMap = toMap(payrollAgg as PayRow[]);
    const expMap = toMap(expenseAgg as ExpRow[]);
    const freMap = toMap(freelancerAgg as ExpRow[]);

    const revenueByMonth = months.map((m) => ({
      month: m,
      collectedPaise: revMap.get(m)?.collectedPaise ?? 0,
    }));
    const payrollByMonth = months.map((m) => ({
      month: m,
      totalNetPaise: payMap.get(m)?.totalNetPaise ?? 0,
      memberCount: payMap.get(m)?.memberCount ?? 0,
    }));
    const expensesByMonth = months.map((m) => ({
      month: m,
      totalPaise: expMap.get(m)?.totalPaise ?? 0,
    }));
    const freelancerByMonth = months.map((m) => ({
      month: m,
      totalPaise: freMap.get(m)?.totalPaise ?? 0,
    }));
    const profitByMonth = months.map((m, i) => ({
      month: m,
      profitPaise:
        (revenueByMonth[i]?.collectedPaise ?? 0) -
        (payrollByMonth[i]?.totalNetPaise ?? 0) -
        (expensesByMonth[i]?.totalPaise ?? 0) -
        (freelancerByMonth[i]?.totalPaise ?? 0),
    }));

    return { revenueByMonth, payrollByMonth, expensesByMonth, freelancerByMonth, profitByMonth };
  }

  async teamEarnings(month?: string) {
    const targetMonth = month ?? lastNMonths(1)[0];
    const slips = await this.payslips
      .find({ month: targetMonth })
      .lean()
      .exec();

    if (!slips.length) return { month: targetMonth, members: [] };

    const userIds = slips.map((s) => s.userId);
    const userDocs = await this.users
      .find({ _id: { $in: userIds } }, { name: 1, email: 1 })
      .lean()
      .exec();
    const nameMap = new Map(userDocs.map((u) => [u._id.toString(), u.name as string]));

    const members = slips
      .map((s) => ({
        userId: s.userId.toString(),
        name: nameMap.get(s.userId.toString()) ?? 'Unknown',
        month: s.month,
        grossPaise: s.grossPaise,
        deductionsPaise: s.deductionsPaise,
        netPaise: s.netPaise,
      }))
      .sort((a, b) => b.netPaise - a.netPaise);

    return { month: targetMonth, members };
  }
}
