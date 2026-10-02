// SowService — OWNER-only resource.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuditAction,
  MilestoneStatus,
  type CreateProjectFromSowInput,
  type CreateSowInput,
  type JwtPayload,
  type SowBriefInput,
  type SowDocumentInput,
  type SowMilestoneInput,
  type UpdateSowInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { Client, type ClientDocument } from '../clients/schemas/client.schema';
import { ProjectsService } from '../projects/projects.service';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { Sow, type SowDocument } from './schemas/sow.schema';

/** Today as UTC midnight — dates are stored as UTC midnight of the calendar day. */
const utcToday = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

const fieldError = (field: string, message: string) =>
  new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message, details: { fieldErrors: { [field]: [message] } } });

@Injectable()
export class SowService {
  constructor(
    @InjectModel(Sow.name) private readonly model: Model<SowDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    private readonly projectsSvc: ProjectsService,
    private readonly events: EventEmitter2,
  ) {}

  list(filter: { clientId?: string; projectId?: string } = {}): Promise<SowDocument[]> {
    const q: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.clientId && Types.ObjectId.isValid(filter.clientId)) q.clientId = new Types.ObjectId(filter.clientId);
    if (filter.projectId && Types.ObjectId.isValid(filter.projectId)) q.projectId = new Types.ObjectId(filter.projectId);
    return this.model.find(q).sort({ createdAt: -1 }).exec();
  }

  async byId(id: string): Promise<SowDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.SOW_NOT_FOUND, message: 'SOW not found' });
    return doc;
  }

  async create(input: CreateSowInput, actorId?: string): Promise<SowDocument> {
    await this.assertClient(input.clientId);
    if (input.projectId) await this.assertProject(input.projectId, input.clientId);
    const doc = await this.model.create({
      clientId: new Types.ObjectId(input.clientId),
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      title: input.title,
      description: input.description ?? '',
      totalValuePaise: input.totalValuePaise,
      currency: input.currency ?? 'INR',
      milestones: this.milestones(input.milestones ?? []),
      sentAt: input.sentAt ?? undefined,
      signedAt: input.signedAt ?? undefined,
    });
    emitAudit(this.events, { actorId, action: AuditAction.SOW_CREATED, entity: 'sow', entityId: doc.id, summary: doc.title });
    if (doc.signedAt) this.auditSigned(doc, actorId);
    return doc;
  }

  async update(id: string, input: UpdateSowInput, actorId?: string): Promise<SowDocument> {
    const doc = await this.byId(id);
    const before = snapshot(doc);
    const wasSigned = !!doc.signedAt;
    const clientId = input.clientId ?? doc.clientId.toString();
    if (input.clientId && input.clientId !== doc.clientId.toString()) await this.assertClient(input.clientId);

    if (input.clientId) doc.clientId = new Types.ObjectId(input.clientId);
    if (input.projectId === null) doc.set('projectId', undefined);
    else if (input.projectId) {
      await this.assertProject(input.projectId, clientId);
      doc.projectId = new Types.ObjectId(input.projectId);
    } else if (input.clientId && doc.projectId) {
      // Moving the SOW to another client keeps its project only if that project belongs to the new client.
      const p = await this.projects.findOne({ _id: doc.projectId, deletedAt: { $exists: false } }).select('clientId').lean().exec();
      if (p?.clientId && p.clientId.toString() !== clientId) doc.set('projectId', undefined);
    }
    if (input.title !== undefined) doc.title = input.title;
    if (input.description !== undefined) doc.description = input.description;
    if (input.totalValuePaise !== undefined) doc.totalValuePaise = input.totalValuePaise;
    if (input.currency !== undefined) doc.currency = input.currency;
    if (input.milestones !== undefined) doc.set('milestones', this.milestones(input.milestones));
    for (const k of ['sentAt', 'signedAt'] as const) {
      if (input[k] === null) doc.set(k, undefined);
      else if (input[k]) doc.set(k, input[k]);
    }
    await doc.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.SOW_UPDATED,
      entity: 'sow',
      entityId: id,
      summary: doc.title,
      before,
      after: snapshot(doc),
    });
    if (!wasSigned && doc.signedAt) this.auditSigned(doc, actorId);
    return doc;
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
    emitAudit(this.events, { actorId, action: AuditAction.SOW_DELETED, entity: 'sow', entityId: id, summary: doc.title });
  }

  async setBrief(id: string, input: SowBriefInput, actorId: string): Promise<SowDocument> {
    const doc = await this.byId(id);
    doc.brief = {
      scopeSummary: input.scopeSummary,
      deliverables: input.deliverables,
      timelineStart: input.timelineStart ? new Date(input.timelineStart) : undefined,
      timelineEnd: input.timelineEnd ? new Date(input.timelineEnd) : undefined,
      revisionRounds: input.revisionRounds ?? 0,
      publishedAt: new Date(),
      publishedBy: new Types.ObjectId(actorId),
    } as never;
    await doc.save();
    return doc;
  }

  async getBrief(id: string): Promise<SowDocument['brief']> {
    const doc = await this.byId(id);
    if (!doc.brief) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Brief not published yet' });
    }
    return doc.brief;
  }

  /** Attach the signed copy — this also marks the SOW signed (on the given date, default today). */
  async setDocument(id: string, input: SowDocumentInput, actorId?: string): Promise<SowDocument> {
    const doc = await this.byId(id);
    const wasSigned = !!doc.signedAt;
    doc.documentKey = input.key;
    doc.documentContentType = input.contentType || undefined;
    doc.signedAt = input.signedAt ?? doc.signedAt ?? utcToday();
    if (!doc.sentAt) doc.sentAt = doc.signedAt;
    await doc.save();
    if (!wasSigned) this.auditSigned(doc, actorId);
    return doc;
  }

  /**
   * Start the project this SOW describes: client and budget from the SOW, its milestones copied
   * over as project milestones, and the SOW linked to the new project.
   */
  async createProject(
    id: string,
    input: CreateProjectFromSowInput,
    actor: Pick<JwtPayload, 'sub' | 'role'>,
  ): Promise<{ project: { _id: string; name: string; code: string }; sow: SowDocument }> {
    const doc = await this.byId(id);
    if (doc.projectId) {
      const existing = await this.projects.findOne({ _id: doc.projectId, deletedAt: { $exists: false } }).select('name').lean().exec();
      if (existing) {
        throw new ConflictException({
          code: ErrorCodes.CONFLICT,
          message: `This SOW already has a project (${existing.name}).`,
        });
      }
    }
    await this.assertClient(doc.clientId.toString());

    const project = await this.projectsSvc.create(
      {
        name: input.name,
        code: input.code,
        description: doc.description ? doc.description.slice(0, 2000) : undefined,
        startDate: input.startDate,
        endDate: input.endDate,
        clientId: doc.clientId.toString(),
        clientBudgetPaise: doc.totalValuePaise,
        currency: doc.currency,
      },
      { sub: actor.sub, role: actor.role },
    );
    try {
      if (doc.milestones.length > 0) {
        await this.projects
          .updateOne(
            { _id: project._id },
            {
              $push: {
                milestones: {
                  $each: doc.milestones.map((m) => ({
                    name: m.title,
                    amountPaise: m.amountPaise,
                    dueDate: m.dueDate,
                    status: 'PENDING',
                    note: `From SOW: ${doc.title}`,
                  })),
                },
              },
            },
          )
          .exec();
      }
      doc.projectId = project._id as Types.ObjectId;
      await doc.save();
    } catch (err) {
      // Don't leave a half-made project behind.
      await this.projects.updateOne({ _id: project._id }, { $set: { deletedAt: new Date() } }).exec();
      throw err;
    }
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.SOW_PROJECT_CREATED,
      entity: 'sow',
      entityId: doc.id,
      summary: `${doc.title} → ${project.name}`,
    });
    return { project: { _id: project.id as string, name: project.name, code: project.code }, sow: doc };
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────────

  private milestones(items: SowMilestoneInput[]) {
    return items.map((m) => ({
      title: m.title,
      amountPaise: m.amountPaise,
      dueDate: m.dueDate,
      status: m.status ?? MilestoneStatus.PENDING,
    }));
  }

  private auditSigned(doc: SowDocument, actorId?: string): void {
    emitAudit(this.events, {
      actorId,
      action: AuditAction.SOW_SIGNED,
      entity: 'sow',
      entityId: doc.id as string,
      summary: `${doc.title} signed ${doc.signedAt?.toISOString().slice(0, 10) ?? ''}`.trim(),
    });
  }

  private async assertClient(clientId: string): Promise<void> {
    const exists = await this.clients.exists({ _id: new Types.ObjectId(clientId), deletedAt: { $exists: false } });
    if (!exists) throw fieldError('clientId', 'That client no longer exists — pick another one');
  }

  private async assertProject(projectId: string, clientId: string): Promise<void> {
    const p = await this.projects.findOne({ _id: new Types.ObjectId(projectId), deletedAt: { $exists: false } }).select('clientId').lean().exec();
    if (!p) throw fieldError('projectId', 'That project no longer exists');
    if (p.clientId && p.clientId.toString() !== clientId) throw fieldError('projectId', 'That project belongs to a different client');
  }
}
