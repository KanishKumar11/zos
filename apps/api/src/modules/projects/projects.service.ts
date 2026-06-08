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

import { Payslip, type PayslipDocument } from '../payroll/schemas/payslip.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { Project, type ProjectDocument } from './schemas/project.schema';

const OWNER_ONLY_FIELDS = ['clientId', 'clientBudgetPaise', 'agencyMarginPaise', 'currency'] as const;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly model: Model<ProjectDocument>,
    @InjectModel(Payslip.name) private readonly slips: Model<PayslipDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
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
        { _id: id, 'members.userId': { $ne: new Types.ObjectId(input.userId) } },
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
      .findByIdAndUpdate(
        id,
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

  /** OWNER-only: record how much was paid to a specific member for this project. */
  async setMemberCost(projectId: string, userId: string, amountPaise: number): Promise<ProjectDocument> {
    const doc = await this.model.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const member = doc.members.find((m) => m.userId.toString() === userId);
    if (!member) throw new NotFoundException({ code: ErrorCodes.MEMBER_NOT_FOUND, message: 'Member not found on project' });
    member.amountPaise = amountPaise;
    return doc.save();
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
