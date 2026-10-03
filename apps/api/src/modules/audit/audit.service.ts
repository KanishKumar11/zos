// AuditService — write & query audit log entries.
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import { AuditAction, EVENT_NAMES, Role } from '@agency/shared';

import type { PaginationDto } from '@/common/dto/pagination.dto';
import { paginate, type Paginated } from '@/common/utils/pagination.util';

import { User, type UserDocument } from '../users/schemas/user.schema';
import { MONEY_ENTITIES, nonOwnerExclusion, presentAuditEntry } from './audit.presenter';
import { AuditLog, type AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditWriteInput {
  actorId?: string;
  entity: string;
  entityId?: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditListFilter {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: AuditAction;
  /** YYYY-MM-DD, inclusive (workspace-local dates are close enough to UTC here). */
  from?: string;
  to?: string;
}

const isYmd = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  write(input: AuditWriteInput): Promise<AuditLogDocument> {
    return this.model.create({
      ...input,
      actorId: input.actorId && Types.ObjectId.isValid(input.actorId) ? new Types.ObjectId(input.actorId) : undefined,
    });
  }

  /** Listens for any audit.* event. Payload must match AuditWriteInput. */
  @OnEvent(`${EVENT_NAMES.audit.write}`, { async: true })
  async onAuditWrite(payload: AuditWriteInput): Promise<void> {
    try {
      await this.write(payload);
    } catch (err) {
      this.logger.warn(`audit write failed: ${(err as Error).message}`);
    }
  }

  /** Paginated entries, newest first, with actor names (and person names for user entities) resolved. */
  async list(
    pagination: PaginationDto,
    filter: AuditListFilter = {},
    viewerRole: Role = Role.OWNER,
  ): Promise<Paginated<Record<string, unknown>>> {
    // Non-owners never get money entries; the rest are redacted by presentAuditEntry below.
    const query: FilterQuery<AuditLogDocument> = viewerRole === Role.OWNER ? {} : nonOwnerExclusion();
    // Entity names were written in mixed case over time ("Invoice" vs "invoice") — match either.
    if (filter.entity) query.entity = new RegExp(`^${escapeRe(filter.entity)}$`, 'i');
    if (filter.entityId) query.entityId = filter.entityId;
    if (filter.actorId && Types.ObjectId.isValid(filter.actorId)) query.actorId = new Types.ObjectId(filter.actorId);
    if (filter.action) query.action = filter.action;
    if (isYmd(filter.from) || isYmd(filter.to)) {
      const range: Record<string, Date> = {};
      if (isYmd(filter.from)) range.$gte = new Date(`${filter.from}T00:00:00.000Z`);
      if (isYmd(filter.to)) range.$lt = new Date(new Date(`${filter.to}T00:00:00.000Z`).getTime() + 86_400_000);
      query.createdAt = range;
    }
    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .lean()
        .exec(),
      this.model.countDocuments(query),
    ]);

    const ids = new Set<string>();
    for (const d of docs) {
      if (d.actorId) ids.add(String(d.actorId));
      if (d.entity?.toLowerCase() === 'user' && d.entityId && Types.ObjectId.isValid(d.entityId)) ids.add(d.entityId);
    }
    const people = ids.size
      ? await this.users
          .find({ _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) } })
          .select({ name: 1, email: 1, deletedAt: 1 })
          .lean()
          .exec()
      : [];
    const nameOf = new Map(people.map((p) => [String(p._id), p.name]));

    const items = docs.map((d) => {
      const actorId = d.actorId ? String(d.actorId) : undefined;
      return presentAuditEntry({
        ...d,
        actorId,
        actorName: actorId ? (nameOf.get(actorId) ?? 'Deleted user') : undefined,
        entityName:
          d.entity?.toLowerCase() === 'user' && d.entityId ? (nameOf.get(d.entityId) ?? 'Deleted user') : undefined,
      } as Record<string, unknown>, viewerRole);
    });
    return paginate(items, total, pagination);
  }

  /** Distinct entity names, for the filter dropdown. */
  async entities(viewerRole: Role = Role.OWNER): Promise<string[]> {
    const raw = (await this.model.distinct('entity').exec()) as string[];
    const names = [...new Set(raw.map((e) => e.toLowerCase()))].sort();
    return viewerRole === Role.OWNER ? names : names.filter((n) => !(MONEY_ENTITIES as readonly string[]).includes(n));
  }
}
