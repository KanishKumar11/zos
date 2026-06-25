// ProjectsService — CRUD + member ops. OWNER-only field stripping handled by SerializeInterceptor.
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import {
  Role,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectMemberInput,
  type UpdateProjectInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { Paginated, paginate } from '@/common/utils/pagination.util';

import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { PayrollRun, type PayrollRunDocument } from '../payroll/schemas/payroll-run.schema';
import { Payslip, type PayslipDocument } from '../payroll/schemas/payslip.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { Project, type ProjectDocument } from './schemas/project.schema';

const OWNER_ONLY_FIELDS = ['clientId', 'clientBudgetPaise', 'agencyMarginPaise', 'currency'] as const;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly model: Model<ProjectDocument>,
    @InjectModel(PayrollRun.name) private readonly runs: Model<PayrollRunDocument>,
    @InjectModel(Payslip.name) private readonly slips: Model<PayslipDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
  ) {}

  async list(q: ListProjectsQuery, viewer: { sub: string; role: Role }): Promise<Paginated<ProjectDocument>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const filter: FilterQuery<ProjectDocument> = { deletedAt: { $exists: false } };
    if (q.status) filter.status = q.status;
    if (q.clientId) filter.clientId = new Types.ObjectId(q.clientId);
    if (q.q) {
      const re = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { code: re }];
    }
    if (viewer.role !== Role.OWNER && viewer.role !== Role.ADMIN) {
      filter['members.userId'] = new Types.ObjectId(viewer.sub);
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async byId(id: string, viewer: { sub: string; role: Role }): Promise<ProjectDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    if (viewer.role !== Role.OWNER && viewer.role !== Role.ADMIN) {
      const isMember = doc.members.some((m) => m.userId.toString() === viewer.sub);
      if (!isMember) throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Not a project member' });
    }
    return doc;
  }

  async create(input: CreateProjectInput, actor: { role: Role }): Promise<ProjectDocument> {
    if (actor.role !== Role.OWNER) {
      for (const f of OWNER_ONLY_FIELDS) {
        if ((input as Record<string, unknown>)[f] !== undefined) {
          throw new ForbiddenException({
            code: ErrorCodes.OWNER_ONLY,
            message: `Field ${f} is OWNER-only`,
          });
        }
      }
    }
    const exists = await this.model.findOne({ code: input.code, deletedAt: { $exists: false } }).exec();
    if (exists) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Project code already taken' });
    }
    const doc = new this.model({
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      clientId: input.clientId ? new Types.ObjectId(input.clientId) : undefined,
      members: (input.members ?? []).map((m) => ({
        userId: new Types.ObjectId(m.userId),
        role: m.role,
        addedAt: new Date(),
      })),
    });
    return doc.save();
  }

  async update(
    id: string,
    input: UpdateProjectInput,
    actor: { role: Role },
  ): Promise<ProjectDocument> {
    if (actor.role !== Role.OWNER) {
      for (const f of OWNER_ONLY_FIELDS) {
        if ((input as Record<string, unknown>)[f] !== undefined) {
          throw new ForbiddenException({
            code: ErrorCodes.OWNER_ONLY,
            message: `Field ${f} is OWNER-only`,
          });
        }
      }
    }
    const patch: Record<string, unknown> = { ...input };
    if (input.startDate) patch.startDate = new Date(input.startDate);
    if (input.endDate) patch.endDate = new Date(input.endDate);
    if (input.clientId) patch.clientId = new Types.ObjectId(input.clientId);
    if (input.members) {
      patch.members = input.members.map((m) => ({
        userId: new Types.ObjectId(m.userId),
        role: m.role,
        addedAt: new Date(),
      }));
    }
    const doc = await this.model
      .findOneAndUpdate({ _id: id, deletedAt: { $exists: false } }, patch, { new: true })
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    return doc;
  }

  async addMember(id: string, input: ProjectMemberInput): Promise<ProjectDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: { $exists: false }, 'members.userId': { $ne: new Types.ObjectId(input.userId) } },
        {
          $push: {
            members: {
              userId: new Types.ObjectId(input.userId),
              role: input.role,
              addedAt: new Date(),
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found or member exists' });
    return doc;
  }

  async removeMember(id: string, userId: string): Promise<ProjectDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: { $exists: false } },
        { $pull: { members: { userId: new Types.ObjectId(userId) } } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    return doc;
  }

  async softDelete(id: string): Promise<void> {
    const res = await this.model.findByIdAndUpdate(id, { deletedAt: new Date() }).exec();
    if (!res) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
  }

  /**
   * Resource availability: list users with the projects they're allocated to.
   * OWNER+ADMIN+LEAD only (enforced at controller). Returns one row per user.
   */
  async availability(): Promise<
    { userId: string; projects: { projectId: string; name: string; code: string; role: string }[] }[]
  > {
    const projects = await this.model
      .find({ deletedAt: { $exists: false }, status: { $ne: 'COMPLETED' } })
      .select('name code members')
      .exec();
    const map = new Map<string, { userId: string; projects: any[] }>();
    for (const p of projects) {
      for (const m of p.members) {
        const uid = m.userId.toString();
        if (!map.has(uid)) map.set(uid, { userId: uid, projects: [] });
        map.get(uid)!.projects.push({
          projectId: p.id,
          name: p.name,
          code: p.code,
          role: m.role,
        });
      }
    }
    return [...map.values()];
  }

  /** OWNER-only: record the budgeted amount for a specific member on this project. */
  async setMemberCost(projectId: string, userId: string, amountPaise: number): Promise<ProjectDocument> {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const member = doc.members.find((m) => m.userId.toString() === userId);
    if (!member) throw new NotFoundException({ code: ErrorCodes.MEMBER_NOT_FOUND, message: 'Member not found on project' });
    member.amountPaise = amountPaise;
    doc.markModified('members');
    return doc.save();
  }

  /** OWNER-only: log a payment made to a specific member for this project. Auto-syncs to payroll. */
  async addMemberPayment(
    projectId: string,
    userId: string,
    input: { amountPaise: number; paidAt: Date; note?: string; forPeriod?: string },
  ): Promise<ProjectDocument> {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const member = doc.members.find((m) => m.userId.toString() === userId);
    if (!member) throw new NotFoundException({ code: ErrorCodes.MEMBER_NOT_FOUND, message: 'Member not found on project' });
    (member.payments as any[]).push({ paidAt: input.paidAt, amountPaise: input.amountPaise, note: input.note ?? '', ...(input.forPeriod ? { forPeriod: input.forPeriod } : {}) });
    doc.markModified('members');
    await doc.save();
    await this.syncPayslip(projectId, doc.name, userId, input.paidAt);
    return doc;
  }

  /** OWNER-only: delete a specific payment entry from a member's payments log. Auto-syncs to payroll. */
  async removeMemberPayment(projectId: string, userId: string, paymentId: string): Promise<ProjectDocument> {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const member = doc.members.find((m) => m.userId.toString() === userId);
    if (!member) throw new NotFoundException({ code: ErrorCodes.MEMBER_NOT_FOUND, message: 'Member not found on project' });
    const removedPayment = member.payments.find((p: any) => p._id.toString() === paymentId);
    const before = member.payments.length;
    (member as any).payments = member.payments.filter((p: any) => p._id.toString() !== paymentId);
    if (member.payments.length === before) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payment not found' });
    doc.markModified('members');
    await doc.save();
    if (removedPayment) await this.syncPayslip(projectId, doc.name, userId, (removedPayment as any).paidAt);
    return doc;
  }

  /**
   * Upsert a payslip for the month of paidAt, reflecting all project payments
   * for this user in that month across ALL projects.
   */
  private async syncPayslip(_projectId: string, _projectName: string, userId: string, paidAt: Date): Promise<void> {
    const month = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(paidAt.getFullYear(), paidAt.getMonth(), 1);
    const end = new Date(paidAt.getFullYear(), paidAt.getMonth() + 1, 1);

    // Collect all project payments for this user in this month across all projects
    const allProjects = await this.model.find({
      'members.userId': new Types.ObjectId(userId),
      deletedAt: { $exists: false },
    }).exec();

    const projectPayments: { projectId: Types.ObjectId; projectName: string; amountPaise: number; paidAt: Date; note: string }[] = [];
    for (const proj of allProjects) {
      const mem = proj.members.find((m) => m.userId.toString() === userId);
      if (!mem) continue;
      for (const pay of mem.payments as any[]) {
        const payDate = new Date(pay.paidAt);
        if (payDate >= start && payDate < end) {
          projectPayments.push({
            projectId: proj._id as Types.ObjectId,
            projectName: proj.name,
            amountPaise: pay.amountPaise,
            paidAt: payDate,
            note: pay.note ?? '',
          });
        }
      }
    }

    const totalPaise = projectPayments.reduce((s, p) => s + p.amountPaise, 0);

    // Find or create payroll run for this month
    let run = await this.runs.findOne({ month }).exec();
    if (!run) {
      run = await this.runs.create({
        month,
        status: 'FINALIZED',
        totalNetPaise: 0,
        employeeCount: 0,
        notes: `Project-based payouts for ${month}`,
      });
    }

    // Upsert the payslip — preserve existing stipend/adjustment portion if present
    const existing = await this.slips.findOne({ runId: run._id, userId: new Types.ObjectId(userId) }).exec();
    const stipendNet = existing ? (existing.netPaise - (existing.projectPayments?.reduce((s, p) => s + p.amountPaise, 0) ?? 0)) : 0;
    const newNet = Math.max(0, stipendNet) + totalPaise;

    await this.slips.findOneAndUpdate(
      { runId: run._id, userId: new Types.ObjectId(userId) },
      {
        $set: {
          runId: run._id,
          month,
          userId: new Types.ObjectId(userId),
          projectPayments,
          netPaise: newNet,
          grossPaise: newNet,
          deductionsPaise: existing?.deductionsPaise ?? 0,
          workingDays: existing?.workingDays ?? 0,
          presentDays: existing?.presentDays ?? 0,
          lopDays: existing?.lopDays ?? 0,
          currency: existing?.currency ?? 'INR',
          breakdown: existing?.breakdown ?? {
            baseAmount: 0, hra: 0, specialAllowance: 0, lopDeduction: 0,
            providentFundEmployee: 0, professionalTax: 0, tdsMonthly: 0,
            lateDeduction: 0, bonusPaise: 0, manualDeductionPaise: 0,
          },
          adjustments: existing?.adjustments ?? [],
        },
      },
      { upsert: true, new: true },
    );

    // Update run totals
    const allSlips = await this.slips.find({ runId: run._id }).exec();
    run.totalNetPaise = allSlips.reduce((s, sl) => s + sl.netPaise, 0);
    run.employeeCount = allSlips.length;
    await run.save();
  }

  async addMilestone(projectId: string, input: { name: string; amountPaise: number; dueDate?: string; note?: string }) {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    (doc.milestones as any[]).push({
      name: input.name,
      amountPaise: input.amountPaise,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      note: input.note ?? '',
      status: 'PENDING',
    });
    doc.markModified('milestones');
    return doc.save();
  }

  async updateMilestone(projectId: string, milestoneId: string, input: { name?: string; amountPaise?: number; dueDate?: string; note?: string; status?: string; invoiceId?: string }) {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const ms = (doc.milestones as any[]).find((m: any) => m._id.toString() === milestoneId);
    if (!ms) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Milestone not found' });
    if (input.name !== undefined) ms.name = input.name;
    if (input.amountPaise !== undefined) ms.amountPaise = input.amountPaise;
    if (input.dueDate !== undefined) ms.dueDate = new Date(input.dueDate);
    if (input.note !== undefined) ms.note = input.note;
    if (input.status !== undefined) ms.status = input.status;
    if (input.invoiceId !== undefined) ms.invoiceId = new Types.ObjectId(input.invoiceId);
    doc.markModified('milestones');
    return doc.save();
  }

  async removeMilestone(projectId: string, milestoneId: string) {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const before = doc.milestones.length;
    (doc as any).milestones = (doc.milestones as any[]).filter((m: any) => m._id.toString() !== milestoneId);
    if (doc.milestones.length === before) throw new NotFoundException({ message: 'Milestone not found' });
    doc.markModified('milestones');
    return doc.save();
  }

  async projectBalance(projectId: string) {
    const [doc, invDocs] = await Promise.all([
      this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec(),
      this.invoices.find({ projectId: new Types.ObjectId(projectId), deletedAt: { $exists: false } }).exec(),
    ]);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });

    const collectedPaise = invDocs.reduce((s, inv) =>
      s + (inv.payments ?? []).reduce((ps: number, p: any) => ps + p.amountPaise, 0), 0);

    const memberIds = doc.members.map((m) => m.userId);
    const userDocs = await this.users.find({ _id: { $in: memberIds } }).select('name').exec();
    const nameMap = new Map(userDocs.map((u) => [u.id as string, u.name]));

    const memberBalances = doc.members.map((m) => {
      const disbursed = (m.payments as any[]).reduce((s: number, p: any) => s + p.amountPaise, 0);
      return {
        userId: m.userId.toString(),
        name: nameMap.get(m.userId.toString()) ?? m.userId.toString(),
        budgetedPaise: m.amountPaise ?? 0,
        disbursedPaise: disbursed,
        pendingPaise: Math.max(0, (m.amountPaise ?? 0) - disbursed),
      };
    });

    const disbursedPaise = memberBalances.reduce((s, m) => s + m.disbursedPaise, 0);
    return { collectedPaise, disbursedPaise, inHandPaise: collectedPaise - disbursedPaise, memberBalances };
  }

  /** OWNER-only: payslip totals per member for this project's date range. */
  async memberCosts(id: string): Promise<{ userId: string; name: string; totalPaidPaise: number }[]> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });

    const memberIds = doc.members.map((m) => m.userId);
    if (memberIds.length === 0) return [];

    // Build month strings for the project's date range
    const start = doc.startDate ?? (doc as unknown as { createdAt: Date }).createdAt ?? new Date();
    const end = doc.endDate ?? new Date();
    const months: string[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    const [slipDocs, userDocs] = await Promise.all([
      this.slips.find({ userId: { $in: memberIds }, month: { $in: months } }).exec(),
      this.users.find({ _id: { $in: memberIds } }).select('name').exec(),
    ]);

    const nameMap = new Map(userDocs.map((u) => [u.id as string, u.name]));
    const totals = new Map<string, number>();
    for (const s of slipDocs) {
      const uid = s.userId.toString();
      totals.set(uid, (totals.get(uid) ?? 0) + s.netPaise);
    }

    return memberIds.map((uid) => ({
      userId: uid.toString(),
      name: nameMap.get(uid.toString()) ?? uid.toString(),
      totalPaidPaise: totals.get(uid.toString()) ?? 0,
    }));
  }
}
