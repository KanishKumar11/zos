// CrmService — opportunities pipeline.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuditAction,
  CrmStage,
  type CreateOpportunityInput,
  type MoveOpportunityInput,
  type UpdateOpportunityInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit } from '@/common/utils/audit.util';

import { ClientsService } from './clients.service';
import { Client, type ClientDocument } from './schemas/client.schema';
import { Opportunity, type OpportunityDocument } from './schemas/opportunity.schema';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const money = (paise: number, currency: string) =>
  `${currency} ${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Fields a PATCH may clear by sending null. */
const CLEARABLE = ['probability', 'expectedCloseDate', 'ownerId'] as const;

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(Opportunity.name) private readonly model: Model<OpportunityDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    private readonly clientsSvc: ClientsService,
    private readonly events: EventEmitter2,
  ) {}

  list(stage?: CrmStage): Promise<OpportunityDocument[]> {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (stage && (Object.values(CrmStage) as string[]).includes(stage)) filter.stage = stage;
    return this.model.find(filter).sort({ stage: 1, position: 1 }).exec();
  }

  async byId(id: string): Promise<OpportunityDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Deal not found' });
    return doc;
  }

  async create(input: CreateOpportunityInput, actorId?: string): Promise<OpportunityDocument> {
    if (input.clientId) await this.assertClient(input.clientId);
    const stage = input.stage ?? CrmStage.LEAD;
    const doc = new this.model({
      title: input.title,
      valuePaise: input.valuePaise,
      currency: input.currency ?? 'INR',
      stage,
      clientId: input.clientId ? new Types.ObjectId(input.clientId) : undefined,
      prospectName: input.clientId ? undefined : input.prospectName,
      probability: input.probability ?? undefined,
      expectedCloseDate: input.expectedCloseDate ?? undefined,
      ownerId: input.ownerId ? new Types.ObjectId(input.ownerId) : undefined,
      notes: input.notes ?? '',
      position: await this.endOf(stage),
    });
    this.applyStage(doc, stage, input.lostReason);
    await doc.save();
    this.auditClose(doc, undefined, actorId);
    return doc;
  }

  async update(id: string, input: UpdateOpportunityInput, actorId?: string): Promise<OpportunityDocument> {
    const doc = await this.byId(id);
    const prevStage = doc.stage;
    if (input.clientId) {
      await this.assertClient(input.clientId);
      doc.clientId = new Types.ObjectId(input.clientId);
      doc.set('prospectName', undefined);
    } else if (input.clientId === null) {
      doc.set('clientId', undefined);
    }
    if (input.prospectName !== undefined && !doc.clientId) doc.prospectName = input.prospectName;
    if (!doc.clientId && !doc.prospectName) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'Pick a client or enter the prospect’s company name',
        details: { fieldErrors: { clientId: ['Pick a client or enter the prospect’s company name'] } },
      });
    }
    if (input.title !== undefined) doc.title = input.title;
    if (input.valuePaise !== undefined) doc.valuePaise = input.valuePaise;
    if (input.currency !== undefined) doc.currency = input.currency;
    if (input.notes !== undefined) doc.notes = input.notes;
    for (const k of CLEARABLE) {
      const v = input[k];
      if (v === null) doc.set(k, undefined);
      else if (v !== undefined) doc.set(k, k === 'ownerId' ? new Types.ObjectId(v as string) : v);
    }
    if (input.stage && input.stage !== prevStage) {
      doc.position = await this.endOf(input.stage);
      this.applyStage(doc, input.stage, input.lostReason);
    } else if (input.lostReason !== undefined && doc.stage === CrmStage.LOST) {
      doc.lostReason = input.lostReason;
    }
    await doc.save();
    this.auditClose(doc, prevStage, actorId);
    return doc;
  }

  async move(id: string, input: MoveOpportunityInput, actorId?: string): Promise<OpportunityDocument> {
    const doc = await this.byId(id);
    const prevStage = doc.stage;
    if (input.stage !== prevStage) {
      doc.position = input.position ?? (await this.endOf(input.stage));
      this.applyStage(doc, input.stage, input.lostReason);
    } else {
      if (input.position !== undefined) doc.position = input.position;
      if (input.lostReason !== undefined && doc.stage === CrmStage.LOST) doc.lostReason = input.lostReason;
    }
    await doc.save();
    this.auditClose(doc, prevStage, actorId);
    return doc;
  }

  /**
   * Won deal with a prospect: add them as a client (or link the existing client with that name)
   * so a project, SOW or contract can be set up for them.
   */
  async convertToClient(id: string, actorId?: string): Promise<OpportunityDocument> {
    const doc = await this.byId(id);
    if (doc.clientId) return doc;
    const name = doc.prospectName?.trim();
    if (!name) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: 'This deal has no company name to add as a client' });
    }
    const existing = await this.clients
      .findOne({ name: new RegExp(`^${escapeRe(name)}$`, 'i'), deletedAt: { $exists: false } })
      .exec();
    const client = existing ?? (await this.clientsSvc.create({ name }, actorId));
    doc.clientId = client._id as Types.ObjectId;
    doc.set('prospectName', undefined);
    await doc.save();
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────────

  private async assertClient(clientId: string): Promise<void> {
    const exists = await this.clients.exists({ _id: new Types.ObjectId(clientId), deletedAt: { $exists: false } });
    if (!exists) {
      throw new BadRequestException({
        code: ErrorCodes.CLIENT_NOT_FOUND,
        message: 'That client no longer exists — pick another one',
        details: { fieldErrors: { clientId: ['That client no longer exists'] } },
      });
    }
  }

  /** Position after the last deal in a stage. */
  private async endOf(stage: CrmStage): Promise<number> {
    const last = await this.model
      .findOne({ stage, deletedAt: { $exists: false } })
      .sort({ position: -1 })
      .select('position')
      .lean()
      .exec();
    return (last?.position ?? 0) + 1024;
  }

  /** Stage bookkeeping: closed date and lost reason follow the stage. */
  private applyStage(doc: OpportunityDocument, stage: CrmStage, lostReason?: string): void {
    doc.stage = stage;
    if (stage === CrmStage.WON || stage === CrmStage.LOST) {
      doc.closedAt = new Date();
    } else {
      doc.set('closedAt', undefined);
    }
    if (stage === CrmStage.LOST) doc.lostReason = lostReason?.trim() || doc.lostReason;
    else doc.set('lostReason', undefined);
  }

  private auditClose(doc: OpportunityDocument, prevStage: CrmStage | undefined, actorId?: string): void {
    if (doc.stage === prevStage) return;
    if (doc.stage !== CrmStage.WON && doc.stage !== CrmStage.LOST) return;
    const won = doc.stage === CrmStage.WON;
    emitAudit(this.events, {
      actorId,
      action: won ? AuditAction.DEAL_WON : AuditAction.DEAL_LOST,
      entity: 'opportunity',
      entityId: doc.id as string,
      summary: `${doc.title} · ${money(doc.valuePaise, doc.currency)}${!won && doc.lostReason ? ` · ${doc.lostReason}` : ''}`,
    });
  }
}
