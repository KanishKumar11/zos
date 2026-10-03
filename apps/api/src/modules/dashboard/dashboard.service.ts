// DashboardService — owner & member metrics aggregations.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { InvoiceStatus, LeaveStatus, TaskStatus } from '@agency/shared';

import { Expense, type ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Income, type IncomeDocument } from '../income/schemas/income.schema';
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
import { balanceOf, isOverdue } from '../invoices/invoice.rules';
import { Payout, type PayoutDocument } from '../payouts/schemas/payout.schema';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { Sow, type SowDocument } from '../sow/schemas/sow.schema';
import { Task, type TaskDocument } from '../tasks/schemas/task.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';

/** Per-document net expense (gross amountPaise less any team-member contributions recovered via payroll). */
const NET_EXPENSE_EXPR = { $subtract: ['$amountPaise', { $sum: '$contributions.amountPaise' }] };

/** Months are bucketed in Indian time so a payment on the 1st at 2am lands in the right month. */
const TZ = 'Asia/Kolkata';

/** Invoice payment net of GST: amount x (subtotal / total). GST collected isn't revenue. */
const NET_OF_TAX_EXPR = {
  $cond: [
    { $gt: ['$totalPaise', 0] },
    { $multiply: ['$payments.amountPaise', { $divide: [{ $ifNull: ['$subTotalPaise', '$totalPaise'] }, '$totalPaise'] }] },
    '$payments.amountPaise',
  ],
};

/**
 * Payroll cost of a payslip: gross pay (tax/PF withheld is still paid out by the company) minus any
 * project payouts the old version folded into payslips - those are counted from the payouts ledger.
 */
const PAYSLIP_COST_EXPR = {
  $max: [0, { $subtract: [{ $ifNull: ['$grossPaise', '$netPaise'] }, { $sum: '$projectPayments.amountPaise' }] }],
};

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
    @InjectModel(Income.name) private readonly income: Model<IncomeDocument>,
    @InjectModel(Payout.name) private readonly payouts: Model<PayoutDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  private monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async sum(model: Model<any>, pipeline: object[]): Promise<number> {
    const [r] = await model
      .aggregate<{ total: number }>([...(pipeline as never[]), { $group: { _id: null, total: { $sum: '$v' } } }])
      .exec();
    return Math.round(r?.total ?? 0);
  }

  private revenue(from: Date, to?: Date) {
    return this.sum(this.invoices, [
      { $match: { deletedAt: { $exists: false } } },
      { $unwind: '$payments' },
      { $match: { 'payments.paidAt': { $gte: from, ...(to ? { $lt: to } : {}) } } },
      { $project: { v: NET_OF_TAX_EXPR } },
    ]);
  }

  private async payrollCost(monthFilter: Record<string, unknown>) {
    const runIds = await this.runs.find({ status: { $in: ['FINALIZED', 'PAID'] }, month: monthFilter }).distinct('_id').exec();
    if (runIds.length === 0) return 0;
    return this.sum(this.payslips, [{ $match: { runId: { $in: runIds } } }, { $project: { v: PAYSLIP_COST_EXPR } }]);
  }

  private payoutTotal(from: Date, to?: Date, payeeType?: string) {
    return this.sum(this.payouts, [
      {
        $match: {
          deletedAt: { $exists: false },
          paidAt: { $gte: from, ...(to ? { $lt: to } : {}) },
          ...(payeeType ? { payeeType } : {}),
        },
      },
      { $project: { v: '$amountPaise' } },
    ]);
  }

  private expenseTotal(from: Date, to?: Date) {
    return this.sum(this.expenses, [
      { $match: { deletedAt: { $exists: false }, date: { $gte: from, ...(to ? { $lt: to } : {}) } } },
      { $project: { v: NET_EXPENSE_EXPR } },
    ]);
  }

  private incomeTotal(from: Date, to?: Date) {
    return this.sum(this.income, [
      { $match: { deletedAt: { $exists: false }, date: { $gte: from, ...(to ? { $lt: to } : {}) } } },
      { $project: { v: '$amountPaise' } },
    ]);
  }

  async owner() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    // India FY: April 1 – March 31
    const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
    const currentMonth = this.monthKey(now);
    const fyMonth = this.monthKey(fyStart);

    const [
      activeProjects,
      activeSows,
      invoiceAgg,
      lastRun,
      rMonth,
      rFY,
      pMonth,
      pFY,
      eMonth,
      eNextMonth,
      eFY,
      teamMonth,
      flMonth,
      teamFY,
      flFY,
      iMonth,
      iFY,
    ] = await Promise.all([
      this.projects.countDocuments({ deletedAt: { $exists: false }, status: 'ACTIVE' }),
      this.sows.countDocuments({ deletedAt: { $exists: false }, signedAt: { $exists: true } }),
      this.invoices
        .aggregate([
          { $match: { deletedAt: { $exists: false } } },
          { $group: { _id: '$status', total: { $sum: '$totalPaise' }, paid: { $sum: '$paidPaise' }, count: { $sum: 1 } } },
        ])
        .exec(),
      this.runs.findOne({ status: { $in: ['FINALIZED', 'PAID'] } }).sort({ month: -1 }).exec(),
      this.revenue(monthStart, monthEnd),
      this.revenue(fyStart),
      this.payrollCost({ $eq: currentMonth }),
      this.payrollCost({ $gte: fyMonth }),
      this.expenseTotal(monthStart, monthEnd),
      this.expenseTotal(monthEnd, nextMonthEnd),
      this.expenseTotal(fyStart),
      this.payoutTotal(monthStart, monthEnd, 'MEMBER'),
      this.payoutTotal(monthStart, monthEnd, 'FREELANCER'),
      this.payoutTotal(fyStart, undefined, 'MEMBER'),
      this.payoutTotal(fyStart, undefined, 'FREELANCER'),
      this.incomeTotal(monthStart, monthEnd),
      this.incomeTotal(fyStart),
    ]);

    const byStatus = Object.fromEntries(
      (invoiceAgg as Array<{ _id: InvoiceStatus; total: number; paid: number; count: number }>).map((r) => [r._id, r]),
    ) as unknown as Partial<Record<InvoiceStatus, { total: number; paid: number; count: number }>>;

    // Same rules as the invoices module: late part-paid invoices are overdue too.
    const openInvoices = await this.invoices
      .find({
        deletedAt: { $exists: false },
        status: { $in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      })
      .select('status totalPaise paidPaise dueDate')
      .lean()
      .exec();
    const outstanding = openInvoices.reduce((s, i) => s + balanceOf(i), 0);
    const overdue = openInvoices.filter((i) => isOverdue(i)).reduce((s, i) => s + balanceOf(i), 0);
    const collected = Object.values(byStatus).reduce((s, r) => s + (r?.paid ?? 0), 0);

    const costsMonth = pMonth + eMonth + teamMonth + flMonth;
    const costsFY = pFY + eFY + teamFY + flFY;

    return {
      activeProjects,
      activeSows,
      invoices: { outstanding, overdue, collected, byStatus },
      lastPayrollRun: lastRun
        ? { month: lastRun.month, totalNetPaise: lastRun.totalNetPaise, memberCount: lastRun.employeeCount }
        : null,
      revenueThisMonth: rMonth,
      revenueThisFinancialYear: rFY,
      otherIncomeThisMonth: iMonth,
      otherIncomeThisFinancialYear: iFY,
      expensesThisMonth: costsMonth,
      expensesNextMonth: eNextMonth,
      costBreakdownThisMonth: {
        payrollPaise: pMonth,
        expensesPaise: eMonth,
        teamPayoutsPaise: teamMonth,
        freelancerPayoutsPaise: flMonth,
      },
      costBreakdownThisFinancialYear: {
        payrollPaise: pFY,
        expensesPaise: eFY,
        teamPayoutsPaise: teamFY,
        freelancerPayoutsPaise: flFY,
      },
      profitThisMonth: rMonth + iMonth - costsMonth,
      profitThisFinancialYear: rFY + iFY - costsFY,
      fyLabel: `FY ${fyStart.getFullYear()}–${String(fyStart.getFullYear() + 1).slice(-2)}`,
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
      // Only released pay (finalized/paid runs) — drafts can still change.
      this.runs
        .find({ status: { $in: ['FINALIZED', 'PAID'] } })
        .distinct('_id')
        .exec()
        .then((runIds) =>
          this.payslips.findOne({ userId: new Types.ObjectId(userId), runId: { $in: runIds } }).sort({ createdAt: -1 }).exec(),
        ),
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
    const startDate = new Date(`${months[0]}-01T00:00:00+05:30`);
    const byMonth = (field: string) => ({ $dateToString: { format: '%Y-%m', date: field, timezone: TZ } });

    const runIds = await this.runs.find({ status: { $in: ['FINALIZED', 'PAID'] }, month: { $gte: months[0] } }).distinct('_id').exec();
    const [revenueAgg, payrollAgg, expenseAgg, payoutAgg, incomeAgg] = await Promise.all([
      this.invoices
        .aggregate<{ _id: string; v: number }>([
          { $match: { deletedAt: { $exists: false } } },
          { $unwind: '$payments' },
          { $match: { 'payments.paidAt': { $gte: startDate } } },
          { $group: { _id: byMonth('$payments.paidAt'), v: { $sum: NET_OF_TAX_EXPR } } },
        ])
        .exec(),
      this.payslips
        .aggregate<{ _id: string; v: number; members: number }>([
          { $match: { runId: { $in: runIds } } },
          { $group: { _id: '$month', v: { $sum: PAYSLIP_COST_EXPR }, members: { $sum: 1 } } },
        ])
        .exec(),
      this.expenses
        .aggregate<{ _id: string; v: number }>([
          { $match: { deletedAt: { $exists: false }, date: { $gte: startDate } } },
          { $group: { _id: byMonth('$date'), v: { $sum: NET_EXPENSE_EXPR } } },
        ])
        .exec(),
      this.payouts
        .aggregate<{ _id: { m: string; t: string }; v: number }>([
          { $match: { deletedAt: { $exists: false }, paidAt: { $gte: startDate } } },
          { $group: { _id: { m: byMonth('$paidAt'), t: '$payeeType' }, v: { $sum: '$amountPaise' } } },
        ])
        .exec(),
      this.income
        .aggregate<{ _id: string; v: number }>([
          { $match: { deletedAt: { $exists: false }, date: { $gte: startDate } } },
          { $group: { _id: byMonth('$date'), v: { $sum: '$amountPaise' } } },
        ])
        .exec(),
    ]);

    const map = (rows: { _id: string; v: number }[]) => new Map(rows.map((r) => [r._id, Math.round(r.v)]));
    const rev = map(revenueAgg);
    const pay = new Map(payrollAgg.map((r) => [r._id, r]));
    const exp = map(expenseAgg);
    const inc = map(incomeAgg);
    const team = new Map(payoutAgg.filter((r) => r._id.t === 'MEMBER').map((r) => [r._id.m, r.v]));
    const fl = new Map(payoutAgg.filter((r) => r._id.t === 'FREELANCER').map((r) => [r._id.m, r.v]));

    const revenueByMonth = months.map((m) => ({ month: m, collectedPaise: rev.get(m) ?? 0 }));
    const payrollByMonth = months.map((m) => ({
      month: m,
      totalNetPaise: Math.round(pay.get(m)?.v ?? 0),
      memberCount: pay.get(m)?.members ?? 0,
    }));
    const expensesByMonth = months.map((m) => ({ month: m, totalPaise: exp.get(m) ?? 0 }));
    const teamPayoutsByMonth = months.map((m) => ({ month: m, totalPaise: team.get(m) ?? 0 }));
    const freelancerByMonth = months.map((m) => ({ month: m, totalPaise: fl.get(m) ?? 0 }));
    const incomeByMonth = months.map((m) => ({ month: m, totalPaise: inc.get(m) ?? 0 }));
    const profitByMonth = months.map((m, i) => ({
      month: m,
      profitPaise:
        revenueByMonth[i]!.collectedPaise +
        incomeByMonth[i]!.totalPaise -
        payrollByMonth[i]!.totalNetPaise -
        expensesByMonth[i]!.totalPaise -
        teamPayoutsByMonth[i]!.totalPaise -
        freelancerByMonth[i]!.totalPaise,
    }));

    return {
      revenueByMonth,
      payrollByMonth,
      expensesByMonth,
      teamPayoutsByMonth,
      freelancerByMonth,
      incomeByMonth,
      profitByMonth,
    };
  }

  async notifications() {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [allUsers, currentRun] = await Promise.all([
      this.users.find({ deletedAt: { $exists: false }, dateOfBirth: { $exists: true } }, { name: 1, dateOfBirth: 1 }).lean().exec(),
      this.runs.findOne({ month: currentMonthStr, status: { $in: ['FINALIZED', 'PAID'] } }).lean().exec(),
    ]);

    // Birthdays within next 7 days (including today)
    const birthdays: { userId: string; name: string; daysUntil: number; dateLabel: string }[] = [];
    for (const u of allUsers) {
      if (!u.dateOfBirth) continue;
      const bday = new Date(u.dateOfBirth as Date);
      const thisYr = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
      const nextBday = thisYr.getTime() < now.setHours(0, 0, 0, 0) ? new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate()) : thisYr;
      const daysUntil = Math.round((nextBday.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
      if (daysUntil <= 7) {
        birthdays.push({
          userId: u._id.toString(),
          name: u.name as string,
          daysUntil,
          dateLabel: nextBday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        });
      }
    }
    birthdays.sort((a, b) => a.daysUntil - b.daysUntil);

    const payrollReminder = !currentRun ? { month: currentMonthStr } : null;

    return { birthdays, payrollReminder };
  }

  async memberStats(userId: string) {
    const months = lastNMonths(12);
    const uid = new Types.ObjectId(userId);

    const [payslips, projects, payouts] = await Promise.all([
      this.payslips.find({ userId: uid, month: { $in: months } }).lean().exec(),
      this.projects.find({ deletedAt: { $exists: false }, 'members.userId': uid }).lean().exec(),
      this.payouts.find({ userId: uid, deletedAt: { $exists: false } }).sort({ paidAt: -1 }).lean().exec(),
    ]);

    const slipMap = new Map(payslips.map((s) => [s.month, s]));

    return {
      earnings: months.map((m) => {
        const s = slipMap.get(m);
        return { month: m, grossPaise: s?.grossPaise ?? 0, netPaise: s?.netPaise ?? 0, deductionsPaise: s?.deductionsPaise ?? 0 };
      }),
      projects: projects.map((p) => {
        const mem = p.members.find((m) => m.userId.toString() === userId);
        return {
          projectId: p._id.toString(),
          projectName: p.name as string,
          projectCode: p.code as string,
          status: p.status as string,
          role: mem?.role,
          amountPaise: mem?.amountPaise ?? 0,
          payments: payouts
            .filter((pay) => pay.projectId?.toString() === p._id.toString())
            .map((pay) => ({ paidAt: pay.paidAt, amountPaise: pay.amountPaise, note: pay.note })),
        };
      }),
    };
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
