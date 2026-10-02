// InvoicesService — invoices to clients: numbering, lock-after-send, payments, write-offs,
// overdue cron, PDF, dashboard. Status always follows the rules in ./invoice.rules.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import {
  AuditAction,
  EVENT_NAMES,
  InvoiceStatus,
  OPEN_INVOICE_STATUSES,
  invoicePaymentMethodLabel,
  type CreateInvoiceInput,
  type ListInvoicesQuery,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { Client, type ClientDocument } from '../clients/schemas/client.schema';
import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { PdfService } from '../pdf/pdf.service';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import {
  addTermsDays,
  balanceOf,
  dayToDate,
  daysPastDue,
  deriveStatus,
  financialYearRange,
  isDuplicateKeyError,
  isOverdue,
  istDay,
  istTodayStart,
  nextInvoiceNumber,
  normalizeStatus,
} from './invoice.rules';
import { Invoice, type InvoiceDocument } from './schemas/invoice.schema';
import { renderInvoiceHtml } from './templates/invoice.template';

/** Who is acting — controllers pass the JWT payload; internal callers (contracts, cron) may omit it. */
export type InvoiceActor = { sub: string } | undefined;

const DEFAULT_TERMS_DAYS = 15;
const DAY_MS = 86_400_000;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const money = (paise: number, currency = 'INR') => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(paise / 100);
  } catch {
    return `${currency} ${(paise / 100).toFixed(2)}`;
  }
};

const LOCKED_MESSAGE =
  'This invoice has been sent, so its client, line items, amounts and GST are locked. ' +
  'You can still change the notes and due date — or write it off and issue a new one.';

export interface InvoicePaymentView {
  _id: string;
  paidAt: Date;
  amountPaise: number;
  reference: string;
  method: string;
  methodLabel: string;
  createdAt?: Date;
}

export interface InvoiceView {
  _id: string;
  number: string;
  clientId: string;
  /** null when the client record no longer exists. */
  clientName: string | null;
  clientDeleted: boolean;
  clientPaymentTermsDays?: number;
  projectId?: string;
  contractId?: string;
  /** Every project the invoice bills (header + line items); name null when deleted. */
  projects: { _id: string; name: string | null }[];
  contracts: { _id: string; name: string | null }[];
  lineItems: {
    description: string;
    qty: number;
    unitPaise: number;
    projectId?: string;
    milestoneId?: string;
    contractId?: string;
  }[];
  subTotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  currency: string;
  status: InvoiceStatus;
  isOverdue: boolean;
  daysOverdue: number;
  /** Client, line items, amounts and GST can no longer change. */
  locked: boolean;
  issueDate?: Date;
  dueDate?: Date;
  sentAt?: Date;
  writtenOffAt?: Date;
  writeOffReason?: string;
  payments: InvoicePaymentView[];
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Shape shared by hydrated docs (after toObject) and aggregate / lean rows. */
type InvoiceRaw = Omit<Invoice, 'payments'> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  payments: (Invoice['payments'][number] & { _id: Types.ObjectId; createdAt?: Date })[];
};

const idStr = (v: unknown): string | undefined => (v ? String(v) : undefined);

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly model: Model<InvoiceDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(Contract.name) private readonly contracts: Model<ContractDocument>,
    private readonly events: EventEmitter2,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  // ── Numbering ─────────────────────────────────────────────────────────────────

  /** Next number for the Indian financial year of `issueDate`, e.g. ZLK-2026-27-0001. */
  nextInvoiceNumber(issueDate: Date = new Date()): Promise<string> {
    return nextInvoiceNumber(this.model, issueDate);
  }

  // ── Reads ─────────────────────────────────────────────────────────────────────

  /**
   * Without `page`: every match as an array (pickers, client / project / contract pages, dashboard).
   * With `page`: `{ items, meta }` with totals for the whole filtered set.
   */
  async list(q: ListInvoicesQuery = {}): Promise<InvoiceView[] | { items: InvoiceView[]; meta: Record<string, unknown> }> {
    const filter = await this.buildFilter(q);
    if (!q.page) {
      const docs = await this.model.find(filter).sort({ createdAt: -1 }).lean().exec();
      return this.present(docs as unknown as InvoiceRaw[]);
    }

    const page = q.page;
    const pageSize = q.pageSize ?? 25;
    const [field, dir] = (q.sort ?? 'issueDate:desc').split(':') as [string, 'asc' | 'desc'];
    const key = field === 'total' ? 'totalPaise' : field === 'balance' ? 'balancePaise' : field;
    const order = dir === 'asc' ? 1 : -1;

    const [res] = await this.model.aggregate<{
      items: InvoiceRaw[];
      totals: { count: number; totalPaise: number; paidPaise: number; balancePaise: number; overduePaise: number }[];
    }>([
      { $match: filter },
      {
        $addFields: {
          balancePaise: {
            $cond: [
              { $eq: ['$status', InvoiceStatus.WRITTEN_OFF] },
              0,
              { $max: [0, { $subtract: ['$totalPaise', '$paidPaise'] }] },
            ],
          },
        },
      },
      {
        $facet: {
          items: [
            { $sort: { [key]: order, createdAt: order, _id: order } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
          ],
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalPaise: { $sum: '$totalPaise' },
                paidPaise: { $sum: '$paidPaise' },
                balancePaise: { $sum: '$balancePaise' },
                overduePaise: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $in: ['$status', [...OPEN_INVOICE_STATUSES]] },
                          { $lt: ['$dueDate', istTodayStart()] },
                          { $gt: ['$balancePaise', 0] },
                        ],
                      },
                      '$balancePaise',
                      0,
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ]);
    const totals = res?.totals[0] ?? { count: 0, totalPaise: 0, paidPaise: 0, balancePaise: 0, overduePaise: 0 };
    return {
      items: await this.present(res?.items ?? []),
      meta: {
        page,
        limit: pageSize,
        total: totals.count,
        totalPages: Math.max(1, Math.ceil(totals.count / pageSize)),
        totals: {
          count: totals.count,
          totalPaise: totals.totalPaise,
          paidPaise: totals.paidPaise,
          balancePaise: totals.balancePaise,
          overduePaise: totals.overduePaise,
        },
      },
    };
  }

  private async buildFilter(q: ListInvoicesQuery): Promise<FilterQuery<InvoiceDocument>> {
    const filter: FilterQuery<InvoiceDocument> = { deletedAt: { $exists: false } };
    const and: FilterQuery<InvoiceDocument>[] = [];

    switch (q.status) {
      case undefined:
        break;
      case 'open':
        filter.status = { $in: [...OPEN_INVOICE_STATUSES] };
        break;
      case 'overdue':
      case InvoiceStatus.OVERDUE:
        // Derived: anything issued with a balance whose due day has passed — part-paid included.
        filter.status = { $in: [...OPEN_INVOICE_STATUSES] };
        filter.dueDate = { $lt: istTodayStart() };
        filter.$expr = { $gt: ['$totalPaise', '$paidPaise'] };
        break;
      case InvoiceStatus.PARTIAL:
      case InvoiceStatus.PARTIALLY_PAID:
        filter.status = { $in: [InvoiceStatus.PARTIAL, InvoiceStatus.PARTIALLY_PAID] };
        break;
      default:
        filter.status = q.status;
    }

    if (q.clientId) filter.clientId = new Types.ObjectId(q.clientId);
    // Match header-level links and combined invoices that link on a line item.
    if (q.projectId) {
      const pid = new Types.ObjectId(q.projectId);
      and.push({ $or: [{ projectId: pid }, { 'lineItems.projectId': pid }] });
    }
    if (q.contractId) {
      const cid = new Types.ObjectId(q.contractId);
      and.push({ $or: [{ contractId: cid }, { 'lineItems.contractId': cid }] });
    }
    if (q.from || q.to) {
      // Inclusive India calendar days.
      const range: Record<string, Date> = {};
      if (q.from) range.$gte = new Date(dayToDate(q.from).getTime() - 330 * 60_000);
      if (q.to) range.$lt = new Date(dayToDate(q.to).getTime() + DAY_MS - 330 * 60_000);
      filter.issueDate = range;
    }
    if (q.q?.trim()) {
      const re = new RegExp(escapeRe(q.q.trim()), 'i');
      const clientIds = await this.clients.find({ name: re }).distinct('_id').exec();
      and.push({ $or: [{ number: re }, { clientId: { $in: clientIds } }] });
    }
    if (and.length) filter.$and = and;
    return filter;
  }

  async byId(id: string): Promise<InvoiceDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc)
      throw new NotFoundException({
        code: ErrorCodes.INVOICE_NOT_FOUND,
        message: 'Invoice not found',
      });
    return doc;
  }

  async view(id: string): Promise<InvoiceView> {
    return this.presentOne(await this.byId(id));
  }

  async presentOne(doc: InvoiceDocument): Promise<InvoiceView> {
    const [v] = await this.present([doc.toObject() as unknown as InvoiceRaw]);
    return v!;
  }

  /** Adds client / project / contract names, balance and overdue flags. Never leaks raw ids as names. */
  private async present(rows: InvoiceRaw[]): Promise<InvoiceView[]> {
    if (rows.length === 0) return [];
    const clientIds = new Set<string>();
    const projectIds = new Set<string>();
    const contractIds = new Set<string>();
    for (const r of rows) {
      if (r.clientId) clientIds.add(String(r.clientId));
      if (r.projectId) projectIds.add(String(r.projectId));
      if (r.contractId) contractIds.add(String(r.contractId));
      for (const li of r.lineItems ?? []) {
        if (li.projectId) projectIds.add(String(li.projectId));
        if (li.contractId) contractIds.add(String(li.contractId));
      }
    }
    const [clients, projects, contracts] = await Promise.all([
      this.clients.find({ _id: { $in: [...clientIds] } }).select('name deletedAt paymentTermsDays').lean().exec(),
      projectIds.size
        ? this.projects.find({ _id: { $in: [...projectIds] }, deletedAt: { $exists: false } }).select('name').lean().exec()
        : [],
      contractIds.size
        ? this.contracts.find({ _id: { $in: [...contractIds] }, deletedAt: { $exists: false } }).select('name').lean().exec()
        : [],
    ]);
    const clientMap = new Map(clients.map((c) => [String(c._id), c]));
    const projectMap = new Map((projects as { _id: unknown; name: string }[]).map((p) => [String(p._id), p.name]));
    const contractMap = new Map((contracts as { _id: unknown; name: string }[]).map((c) => [String(c._id), c.name]));
    const now = new Date();

    return rows.map((r) => {
      const status = normalizeStatus(r.status);
      const client = clientMap.get(String(r.clientId));
      const pIds = [...new Set([r.projectId, ...(r.lineItems ?? []).map((li) => li.projectId)].filter(Boolean).map(String))];
      const cIds = [...new Set([r.contractId, ...(r.lineItems ?? []).map((li) => li.contractId)].filter(Boolean).map(String))];
      const base = { status, totalPaise: r.totalPaise, paidPaise: r.paidPaise, dueDate: r.dueDate };
      const overdue = isOverdue(base, now);
      return {
        _id: String(r._id),
        number: r.number,
        clientId: String(r.clientId),
        clientName: client?.name ?? null,
        clientDeleted: !client || !!(client as { deletedAt?: Date }).deletedAt,
        clientPaymentTermsDays: client?.paymentTermsDays,
        projectId: idStr(r.projectId),
        contractId: idStr(r.contractId),
        projects: pIds.map((id) => ({ _id: id, name: projectMap.get(id) ?? null })),
        contracts: cIds.map((id) => ({ _id: id, name: contractMap.get(id) ?? null })),
        lineItems: (r.lineItems ?? []).map((li) => ({
          description: li.description,
          qty: li.qty,
          unitPaise: li.unitPaise,
          projectId: idStr(li.projectId),
          milestoneId: idStr(li.milestoneId),
          contractId: idStr(li.contractId),
        })),
        subTotalPaise: r.subTotalPaise,
        gstPercent: r.gstPercent ?? 0,
        gstPaise: r.gstPaise,
        totalPaise: r.totalPaise,
        paidPaise: r.paidPaise,
        balancePaise: balanceOf(base),
        currency: r.currency ?? 'INR',
        status,
        isOverdue: overdue,
        daysOverdue: overdue ? daysPastDue(r.dueDate, now) : 0,
        locked: status !== InvoiceStatus.DRAFT,
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        sentAt: r.sentAt,
        writtenOffAt: r.writtenOffAt,
        writeOffReason: r.writeOffReason,
        payments: (r.payments ?? []).map((p) => ({
          _id: String(p._id),
          paidAt: p.paidAt,
          amountPaise: p.amountPaise,
          reference: p.reference ?? '',
          method: p.method ?? '',
          methodLabel: invoicePaymentMethodLabel(p.method),
          createdAt: p.createdAt,
        })),
        notes: r.notes ?? '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  // ── Totals / milestones ─────────────────────────────────────────────────────────

  private computeTotals(doc: InvoiceDocument): void {
    const subTotal = doc.lineItems.reduce((acc, li) => acc + Math.round(li.qty * li.unitPaise), 0);
    const gst = Math.round((subTotal * (doc.gstPercent ?? 0)) / 100);
    doc.subTotalPaise = subTotal;
    doc.gstPaise = gst;
    doc.totalPaise = subTotal + gst;
    doc.paidPaise = doc.payments.reduce((acc, p) => acc + p.amountPaise, 0);
  }

  /** Line-item ids arrive as strings from Zod; Mongoose needs ObjectIds to query on them. */
  private normalizeLineItems(items: CreateInvoiceInput['lineItems']) {
    return items.map((li) => ({
      description: li.description,
      qty: li.qty,
      unitPaise: li.unitPaise,
      projectId: li.projectId ? new Types.ObjectId(li.projectId) : undefined,
      milestoneId: li.milestoneId ? new Types.ObjectId(li.milestoneId) : undefined,
      contractId: li.contractId ? new Types.ObjectId(li.contractId) : undefined,
    }));
  }

  /**
   * Keep `Project.milestones[].status/invoiceId` in step with the milestones this
   * invoice bills: linked milestones become INVOICED (COLLECTED once fully paid),
   * and milestones dropped from the invoice are released back to PENDING.
   */
  private async syncMilestones(doc: InvoiceDocument): Promise<void> {
    const linked = new Map<string, Set<string>>();
    for (const li of doc.lineItems) {
      if (!li.projectId || !li.milestoneId) continue;
      const key = li.projectId.toString();
      if (!linked.has(key)) linked.set(key, new Set());
      linked.get(key)!.add(li.milestoneId.toString());
    }

    const collected = doc.totalPaise > 0 && doc.paidPaise >= doc.totalPaise;
    const affected = await this.projects
      .find({
        $or: [
          { _id: { $in: [...linked.keys()].map((id) => new Types.ObjectId(id)) } },
          { 'milestones.invoiceId': doc._id },
        ],
      })
      .exec();

    for (const project of affected) {
      const wanted = linked.get(project.id as string) ?? new Set<string>();
      let dirty = false;
      for (const ms of project.milestones as unknown as {
        _id: Types.ObjectId;
        status: string;
        invoiceId?: Types.ObjectId;
      }[]) {
        if (wanted.has(ms._id.toString())) {
          const status = collected ? 'COLLECTED' : 'INVOICED';
          if (ms.status !== status || ms.invoiceId?.toString() !== doc.id) {
            ms.status = status;
            ms.invoiceId = doc._id as Types.ObjectId;
            dirty = true;
          }
        } else if (ms.invoiceId?.toString() === doc.id) {
          // No longer billed by this invoice — release it.
          ms.status = 'PENDING';
          ms.invoiceId = undefined;
          dirty = true;
        }
      }
      if (dirty) {
        project.markModified('milestones');
        await project.save();
      }
    }
  }

  /** Recompute status from payments / due date (DRAFT and WRITTEN_OFF are left alone). */
  private applyDerivedStatus(doc: InvoiceDocument): void {
    doc.status = deriveStatus({
      status: normalizeStatus(doc.status),
      totalPaise: doc.totalPaise,
      paidPaise: doc.paidPaise,
      dueDate: doc.dueDate,
    });
  }

  private audit(
    actor: InvoiceActor,
    action: AuditAction,
    doc: InvoiceDocument,
    summary: string,
    before?: unknown,
    after?: unknown,
  ): void {
    emitAudit(this.events, {
      actorId: actor?.sub,
      action,
      entity: 'Invoice',
      entityId: doc.id as string,
      summary,
      before,
      after,
    });
  }

  private statusAudit(actor: InvoiceActor, doc: InvoiceDocument, from: InvoiceStatus, why?: string): void {
    const to = normalizeStatus(doc.status);
    if (normalizeStatus(from) === to) return;
    this.audit(actor, AuditAction.INVOICE_STATUS_CHANGED, doc, `${doc.number}: ${from} → ${to}${why ? ` (${why})` : ''}`, { status: from }, { status: to });
  }

  // ── Create / update ───────────────────────────────────────────────────────────

  private async activeClient(clientId: string): Promise<ClientDocument> {
    const client = await this.clients.findOne({ _id: clientId, deletedAt: { $exists: false } }).exec();
    if (!client)
      throw new NotFoundException({
        code: ErrorCodes.CLIENT_NOT_FOUND,
        message: 'That client no longer exists. Pick another client.',
        details: { fieldErrors: { clientId: ['That client no longer exists'] } },
      });
    return client;
  }

  private assertDueAfterIssue(issueDate: Date | undefined, dueDate: Date | undefined): void {
    if (issueDate && dueDate && istDay(dueDate) < istDay(issueDate)) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "The due date can't be before the issue date.",
        details: { fieldErrors: { dueDate: ["Can't be before the issue date"] } },
      });
    }
  }

  async create(input: CreateInvoiceInput, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const client = await this.activeClient(input.clientId);
    const issueDate = input.issueDate ? new Date(input.issueDate) : dayToDate(istDay(new Date()));
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : addTermsDays(issueDate, client.paymentTermsDays ?? DEFAULT_TERMS_DAYS);
    this.assertDueAfterIssue(issueDate, dueDate);

    let currency = input.currency;
    if (!currency) {
      const s = await this.settings.get().catch(() => undefined);
      currency = s?.defaultCurrency || 'INR';
    }

    const manualNumber = input.number?.trim();
    const doc = new this.model({
      ...input,
      number: manualNumber || 'pending',
      clientId: client._id,
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      contractId: input.contractId ? new Types.ObjectId(input.contractId) : undefined,
      lineItems: this.normalizeLineItems(input.lineItems),
      status: InvoiceStatus.DRAFT,
      currency,
      issueDate,
      dueDate,
    });
    this.computeTotals(doc);

    // Auto numbers retry on a duplicate key so two invoices created at once both succeed.
    for (let attempt = 0; ; attempt++) {
      if (!manualNumber) doc.number = await this.nextInvoiceNumber(issueDate);
      try {
        await doc.save();
        break;
      } catch (err) {
        if (!isDuplicateKeyError(err, 'number')) throw err;
        if (manualNumber) {
          throw new ConflictException({
            code: ErrorCodes.CONFLICT,
            message: `Invoice number ${manualNumber} is already used.`,
            details: { fieldErrors: { number: ['Already used by another invoice'] } },
          });
        }
        if (attempt >= 2) {
          throw new ConflictException({
            code: ErrorCodes.CONFLICT,
            message: "Couldn't assign an invoice number — another invoice was being created at the same time. Please try again.",
          });
        }
      }
    }
    await this.syncMilestones(doc);
    this.audit(
      actor,
      AuditAction.INVOICE_CREATED,
      doc,
      `${doc.number} for ${client.name} — ${money(doc.totalPaise, doc.currency)}`,
      undefined,
      snapshot(doc),
    );
    return doc;
  }

  /** Changes to fields that are locked once an invoice is issued. */
  private lockedChanges(doc: InvoiceDocument, input: UpdateInvoiceInput): string[] {
    const changed: string[] = [];
    const same = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');
    if (input.clientId !== undefined && !same(input.clientId, doc.clientId)) changed.push('client');
    if (input.projectId !== undefined && !same(input.projectId, doc.projectId)) changed.push('project');
    if (input.contractId !== undefined && !same(input.contractId, doc.contractId)) changed.push('contract');
    if (input.gstPercent !== undefined && (input.gstPercent ?? 0) !== (doc.gstPercent ?? 0)) changed.push('GST');
    if (input.currency !== undefined && input.currency !== doc.currency) changed.push('currency');
    if (input.issueDate !== undefined && (!doc.issueDate || istDay(input.issueDate) !== istDay(doc.issueDate)))
      changed.push('issue date');
    if (input.lineItems !== undefined) {
      const key = (li: { description: string; qty: number; unitPaise: number; projectId?: unknown; milestoneId?: unknown; contractId?: unknown }) =>
        [li.description, li.qty, li.unitPaise, li.projectId ?? '', li.milestoneId ?? '', li.contractId ?? ''].map(String).join('|');
      const a = input.lineItems.map(key).join('\n');
      const b = doc.lineItems.map(key).join('\n');
      if (a !== b) changed.push('line items');
    }
    return changed;
  }

  async update(id: string, input: UpdateInvoiceInput, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    const before = snapshot(doc);
    const fromStatus = normalizeStatus(doc.status);
    const { status: wantedStatus, ...fields } = input;

    if (wantedStatus && normalizeStatus(wantedStatus) !== fromStatus) {
      if (fromStatus === InvoiceStatus.DRAFT && wantedStatus === InvoiceStatus.SENT) {
        // Treated as "Mark as sent" after the other edits are applied below.
      } else {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Status follows payments and due dates. Use Mark as sent, Record payment, Write off or Reopen instead.',
        });
      }
    }

    if (doc.status !== InvoiceStatus.DRAFT) {
      const changed = this.lockedChanges(doc, fields);
      if (changed.length) {
        throw new ConflictException({
          code: ErrorCodes.CONFLICT,
          message: `${LOCKED_MESSAGE} (Tried to change: ${changed.join(', ')}.)`,
        });
      }
    }

    if (fields.clientId && fields.clientId !== String(doc.clientId)) {
      doc.clientId = (await this.activeClient(fields.clientId))._id as Types.ObjectId;
    }
    if (fields.projectId !== undefined) doc.projectId = fields.projectId ? new Types.ObjectId(fields.projectId) : undefined;
    if (fields.contractId !== undefined) doc.contractId = fields.contractId ? new Types.ObjectId(fields.contractId) : undefined;
    if (fields.lineItems) doc.lineItems = this.normalizeLineItems(fields.lineItems) as never;
    if (fields.gstPercent !== undefined) doc.gstPercent = fields.gstPercent;
    if (fields.currency !== undefined) doc.currency = fields.currency;
    if (fields.issueDate !== undefined) doc.issueDate = new Date(fields.issueDate);
    if (fields.notes !== undefined) doc.notes = fields.notes;
    if (fields.dueDate !== undefined) {
      const next = new Date(fields.dueDate);
      if (!doc.dueDate || istDay(next) !== istDay(doc.dueDate)) {
        doc.dueDate = next;
        // A new due date gets its own overdue reminder.
        doc.overdueNotifiedAt = undefined;
      }
    }
    this.assertDueAfterIssue(doc.issueDate, doc.dueDate);

    this.computeTotals(doc);
    if (wantedStatus === InvoiceStatus.SENT && fromStatus === InvoiceStatus.DRAFT) this.markSent(doc);
    this.applyDerivedStatus(doc);
    await doc.save();
    await this.syncMilestones(doc);

    this.audit(actor, AuditAction.INVOICE_UPDATED, doc, `${doc.number} edited`, before, snapshot(doc));
    this.statusAudit(actor, doc, fromStatus);
    return doc;
  }

  private markSent(doc: InvoiceDocument): void {
    if (doc.totalPaise <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Add at least one line item with an amount before sending this invoice.',
      });
    }
    doc.status = InvoiceStatus.SENT;
    doc.sentAt = new Date();
    if (!doc.issueDate) doc.issueDate = dayToDate(istDay(new Date()));
  }

  /** DRAFT → SENT. Locks the amounts. Idempotent for invoices already sent. */
  async send(id: string, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    if (doc.status !== InvoiceStatus.DRAFT) return doc;
    const from = doc.status;
    if (!doc.dueDate && doc.issueDate) {
      const client = await this.clients.findById(doc.clientId).select('paymentTermsDays').lean().exec();
      doc.dueDate = addTermsDays(doc.issueDate, client?.paymentTermsDays ?? DEFAULT_TERMS_DAYS);
    }
    this.markSent(doc);
    this.applyDerivedStatus(doc);
    await doc.save();
    this.statusAudit(actor, doc, from, 'marked as sent');
    return doc;
  }

  /** Close an issued invoice that won't be paid. Terminal until reopened. */
  async writeOff(id: string, reason: string, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    const from = normalizeStatus(doc.status);
    if (from === InvoiceStatus.DRAFT)
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: "Drafts haven't been sent — delete the draft instead of writing it off." });
    if (from === InvoiceStatus.WRITTEN_OFF)
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'This invoice is already written off.' });
    if (from === InvoiceStatus.PAID)
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'This invoice is fully paid — there is nothing left to write off.' });

    const balance = balanceOf(doc);
    doc.status = InvoiceStatus.WRITTEN_OFF;
    doc.writtenOffAt = new Date();
    doc.writeOffReason = reason.trim();
    await doc.save();
    this.audit(
      actor,
      AuditAction.INVOICE_WRITTEN_OFF,
      doc,
      `${doc.number}: ${money(balance, doc.currency)} written off — ${doc.writeOffReason}`,
      { status: from },
      { status: doc.status, writeOffReason: doc.writeOffReason, balancePaise: balance },
    );
    return doc;
  }

  /** Undo a write-off; status goes back to whatever the payments say. */
  async reopen(id: string, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    if (doc.status !== InvoiceStatus.WRITTEN_OFF)
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Only written-off invoices can be reopened.' });
    doc.status = InvoiceStatus.SENT;
    doc.writtenOffAt = undefined;
    doc.writeOffReason = undefined;
    this.applyDerivedStatus(doc);
    await doc.save();
    this.statusAudit(actor, doc, InvoiceStatus.WRITTEN_OFF, 'reopened');
    return doc;
  }

  /** New DRAFT with the same client and line items, a new number and today's date. */
  async duplicate(id: string, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const src = await this.byId(id);
    const client = await this.clients.findOne({ _id: src.clientId, deletedAt: { $exists: false } }).lean().exec();
    if (!client)
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: "This invoice's client was deleted, so it can't be duplicated.",
      });
    return this.create(
      {
        clientId: String(src.clientId),
        projectId: idStr(src.projectId),
        contractId: idStr(src.contractId),
        // Milestones are billed once — the copy keeps the project link but not the milestone.
        lineItems: src.lineItems.map((li) => ({
          description: li.description,
          qty: li.qty,
          unitPaise: li.unitPaise,
          projectId: idStr(li.projectId),
          contractId: idStr(li.contractId),
        })),
        gstPercent: src.gstPercent,
        currency: src.currency,
        notes: src.notes || undefined,
      },
      actor,
    );
  }

  // ── Payments ──────────────────────────────────────────────────────────────────

  async recordPayment(id: string, input: RecordPaymentInput, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    const from = normalizeStatus(doc.status);
    if (from === InvoiceStatus.DRAFT)
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: 'Send the invoice first — payments can only be recorded on sent invoices.',
      });
    if (from === InvoiceStatus.WRITTEN_OFF)
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: 'This invoice was written off. Reopen it to record a payment.',
      });

    const balance = balanceOf(doc);
    if (balance <= 0)
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'This invoice is already fully paid.' });
    if (input.amountPaise > balance) {
      const msg = `That's more than the balance due (${money(balance, doc.currency)}).`;
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: msg,
        details: { fieldErrors: { amountPaise: [`More than the balance due (${money(balance, doc.currency)})`] } },
      });
    }
    const paidAt = new Date(input.paidAt);
    if (istDay(paidAt) > istDay(new Date()))
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "The payment date can't be in the future.",
        details: { fieldErrors: { paidAt: ["Can't be in the future"] } },
      });

    doc.payments.push({
      paidAt,
      amountPaise: input.amountPaise,
      reference: input.reference?.trim() ?? '',
      method: input.method ?? '',
    } as never);
    this.computeTotals(doc);
    this.applyDerivedStatus(doc);
    await doc.save();
    await this.syncMilestones(doc);

    const methodLabel = invoicePaymentMethodLabel(input.method);
    this.audit(
      actor,
      AuditAction.INVOICE_PAYMENT_RECORDED,
      doc,
      `${money(input.amountPaise, doc.currency)} received on ${doc.number}${methodLabel ? ` by ${methodLabel}` : ''}`,
      undefined,
      { amountPaise: input.amountPaise, paidAt, method: input.method, reference: input.reference, balancePaise: balanceOf(doc) },
    );
    this.statusAudit(actor, doc, from, 'payment recorded');
    return doc;
  }

  async removePayment(id: string, paymentId: string, actor?: InvoiceActor): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    const from = normalizeStatus(doc.status);
    const payments = doc.payments as unknown as (Invoice['payments'][number] & { _id: Types.ObjectId })[];
    const idx = payments.findIndex((p) => String(p._id) === paymentId);
    if (idx < 0) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payment not found on this invoice' });
    const [removed] = doc.payments.splice(idx, 1) as unknown as (typeof payments)[number][];
    this.computeTotals(doc);
    this.applyDerivedStatus(doc);
    await doc.save();
    await this.syncMilestones(doc);

    this.audit(
      actor,
      AuditAction.INVOICE_PAYMENT_REMOVED,
      doc,
      `${money(removed!.amountPaise, doc.currency)} payment removed from ${doc.number}`,
      { amountPaise: removed!.amountPaise, paidAt: removed!.paidAt, method: removed!.method, reference: removed!.reference },
      { balancePaise: balanceOf(doc) },
    );
    this.statusAudit(actor, doc, from, 'payment removed');
    return doc;
  }

  /** Only drafts can be deleted; issued invoices are written off instead so the books stay complete. */
  async remove(id: string, actor?: InvoiceActor): Promise<void> {
    const doc = await this.byId(id);
    if (doc.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: 'Only draft invoices can be deleted. This one has been sent — write it off instead.',
      });
    }
    const before = snapshot(doc);
    doc.deletedAt = new Date();
    await doc.save();
    // Release any milestones this invoice was holding.
    doc.lineItems = [] as never;
    await this.syncMilestones(doc);
    this.audit(actor, AuditAction.INVOICE_DELETED, doc, `Draft ${doc.number} deleted`, before);
  }

  // ── Overdue cron ───────────────────────────────────────────────────────────────

  /**
   * Hourly: invoices whose due day has passed with money still owed. Unpaid ones become
   * OVERDUE; part-paid ones stay PARTIAL (the list derives `isOverdue`). The overdue
   * notification fires once per invoice (per due date).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async markOverdue(): Promise<void> {
    const candidates = await this.model
      .find({
        deletedAt: { $exists: false },
        status: { $in: [...OPEN_INVOICE_STATUSES] },
        dueDate: { $lt: istTodayStart() },
        $expr: { $gt: ['$totalPaise', '$paidPaise'] },
      })
      .exec();
    for (const inv of candidates) {
      const from = inv.status;
      this.applyDerivedStatus(inv);
      let dirty = inv.status !== from;
      let notify = false;
      if (!inv.overdueNotifiedAt) {
        inv.overdueNotifiedAt = new Date();
        dirty = true;
        // Invoices the old cron already flipped to OVERDUE (sent before `sentAt` existed) were
        // notified back then — record that instead of sending the reminder again.
        notify = !(from === InvoiceStatus.OVERDUE && !inv.sentAt);
      }
      if (!dirty) continue;
      await inv.save();
      if (notify) {
        this.events.emit(EVENT_NAMES.invoice.overdue, {
          invoiceId: inv.id,
          clientId: inv.clientId.toString(),
          totalPaise: inv.totalPaise,
          balancePaise: balanceOf(inv),
        });
      }
    }
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────

  async invoicePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const inv = await this.byId(id);
    const client = await this.clients.findById(inv.clientId).exec();
    const settings = await this.settings.get();

    // Resolve project names so a multi-project invoice groups its lines by project.
    const projectIds = [...new Set(inv.lineItems.filter((li) => li.projectId).map((li) => li.projectId!.toString()))];
    const projectDocs = projectIds.length
      ? await this.projects.find({ _id: { $in: projectIds } }).select('name').lean().exec()
      : [];
    const projectNames = new Map(projectDocs.map((p) => [p._id.toString(), p.name]));

    const html = renderInvoiceHtml({
      agency: {
        name: settings.workspaceName,
        address:
          [settings.addressLine1, settings.addressLine2, settings.city, settings.state, settings.postalCode]
            .filter(Boolean)
            .join(', ') || undefined,
        gstin: settings.gstin,
        pan: settings.pan,
        state: settings.state || undefined,
      },
      client: {
        name: client?.name ?? 'Client',
        gstin: client?.gstin || undefined,
        cin: client?.cin || undefined,
        address: client?.address || undefined,
        state: client?.state || undefined,
      },
      number: inv.number,
      status: normalizeStatus(inv.status),
      isOverdue: isOverdue(inv),
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paymentTermsDays: client?.paymentTermsDays,
      currency: inv.currency,
      lineItems: inv.lineItems.map((li) => ({
        description: li.description,
        qty: li.qty,
        unitPaise: li.unitPaise,
        projectName: li.projectId ? projectNames.get(li.projectId.toString()) : undefined,
      })),
      subTotalPaise: inv.subTotalPaise,
      gstPercent: inv.gstPercent,
      gstPaise: inv.gstPaise,
      totalPaise: inv.totalPaise,
      paidPaise: inv.paidPaise,
      notes: inv.notes,
      payments: inv.payments.map((p) => ({
        paidAt: p.paidAt,
        amountPaise: p.amountPaise,
        reference: p.reference || undefined,
        method: invoicePaymentMethodLabel(p.method) || undefined,
      })),
    });
    const buffer = await this.pdf.renderPdf(html, { fitOnePage: true });
    try {
      const key = `invoices/${inv.number}.pdf`;
      await this.storage.putBuffer(key, buffer, 'application/pdf');
      inv.pdfKey = key;
      await inv.save();
    } catch {
      // ignore upload failures
    }
    return { buffer, filename: `${inv.number}.pdf` };
  }

  // ── Dashboard / aging ─────────────────────────────────────────────────────────

  async dashboard(): Promise<{
    billedPaise: number;
    collectedPaise: number;
    outstandingPaise: number;
    overduePaise: number;
    counts: Record<string, number>;
    openCount: number;
    overdueCount: number;
    draftCount: number;
    draftPaise: number;
    collectedFyPaise: number;
    fyLabel: string;
  }> {
    const all = await this.model
      .find({ deletedAt: { $exists: false } })
      .select('status totalPaise paidPaise dueDate payments.paidAt payments.amountPaise')
      .lean()
      .exec();
    const fy = financialYearRange();
    const now = new Date();
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    let openCount = 0;
    let overdueCount = 0;
    let draftCount = 0;
    let draftPaise = 0;
    let collectedFy = 0;
    const counts: Record<string, number> = {};
    for (const inv of all) {
      const status = normalizeStatus(inv.status);
      counts[status] = (counts[status] ?? 0) + 1;
      for (const p of inv.payments ?? []) {
        const at = new Date(p.paidAt).getTime();
        if (at >= fy.start.getTime() && at < fy.end.getTime()) collectedFy += p.amountPaise;
      }
      if (status === InvoiceStatus.DRAFT) {
        draftCount++;
        draftPaise += inv.totalPaise;
        continue;
      }
      billed += inv.totalPaise;
      collected += inv.paidPaise;
      const open = balanceOf({ ...inv, status });
      if (OPEN_INVOICE_STATUSES.includes(status)) {
        outstanding += open;
        openCount++;
        if (isOverdue({ ...inv, status }, now)) {
          overdue += open;
          overdueCount++;
        }
      }
    }
    return {
      billedPaise: billed,
      collectedPaise: collected,
      outstandingPaise: outstanding,
      overduePaise: overdue,
      counts,
      openCount,
      overdueCount,
      draftCount,
      draftPaise,
      collectedFyPaise: collectedFy,
      fyLabel: fy.label,
    };
  }

  async aging(): Promise<{ range: string; countInvoices: number; openPaise: number }[]> {
    const now = new Date();
    const open = await this.model
      .find({ deletedAt: { $exists: false }, status: { $in: [...OPEN_INVOICE_STATUSES] } })
      .lean()
      .exec();
    const buckets = [
      { range: '0-30', max: 30, count: 0, paise: 0 },
      { range: '31-60', max: 60, count: 0, paise: 0 },
      { range: '61-90', max: 90, count: 0, paise: 0 },
      { range: '90+', max: Infinity, count: 0, paise: 0 },
    ];
    for (const inv of open) {
      const balance = balanceOf(inv);
      if (balance <= 0) continue;
      const anchor = inv.dueDate ?? inv.issueDate;
      if (!anchor) continue;
      const days = daysPastDue(anchor, now);
      const bucket = buckets.find((b) => days <= b.max)!;
      bucket.count++;
      bucket.paise += balance;
    }
    return buckets.map((b) => ({ range: b.range, countInvoices: b.count, openPaise: b.paise }));
  }
}
