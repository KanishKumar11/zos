// AuditService — write & query audit log entries.
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import { AuditAction, EVENT_NAMES } from '@agency/shared';

import type { PaginationDto } from '@/common/dto/pagination.dto';
import { paginate, type Paginated } from '@/common/utils/pagination.util';

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

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>) {}

  write(input: AuditWriteInput): Promise<AuditLogDocument> {
    return this.model.create({
      ...input,
      actorId: input.actorId ? new Types.ObjectId(input.actorId) : undefined,
    });
  }

  /** Listens for any audit.* event. Payload must match AuditWriteInput. */
  @OnEvent(`${EVENT_NAMES.audit.write}`)
  async onAuditWrite(payload: AuditWriteInput): Promise<void> {
    await this.write(payload);
  }

  async list(
    pagination: PaginationDto,
    filter: { entity?: string; actorId?: string; action?: AuditAction } = {},
  ): Promise<Paginated<AuditLogDocument>> {
    const query: FilterQuery<AuditLogDocument> = {};
    if (filter.entity) query.entity = filter.entity;
    if (filter.actorId) query.actorId = new Types.ObjectId(filter.actorId);
    if (filter.action) query.action = filter.action;
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .exec(),
      this.model.countDocuments(query),
    ]);
    return paginate(items, total, pagination);
  }
}
