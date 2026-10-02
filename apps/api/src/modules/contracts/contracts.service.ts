// ContractsService — CRUD for retainer contracts, billing summaries, and monthly invoice generation.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuditAction,
  ContractStatus,
  InvoiceStatus,
  type CreateContractInput,
  type GenerateClientInvoiceInput,
  type GenerateContractInvoiceInput,
  type ListContractsQuery,
  type UpdateContractInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { Client, type ClientDocument } from '../clients/schemas/client.schema';
import { InvoicesService } from '../invoices/invoices.service';
import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Contract, type ContractDocument } from './schemas/contract.schema';

/** What a contract has been billed so far (drafts and written-off invoices don't count as billed). */
export interface ContractBilling {
  billedPaise: number;
  paidPaise: number;
  /** Live invoices of any status, drafts included. */
  invoiceCount: number;
  /** YYYY-MM months that already have a live invoice (drafts included) — used for "due this month". */
  billedMonths: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_BILLED: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.WRITTEN_OFF];
/** Fields a PATCH may clear by sending null. */
const CLEARABLE = ['startDate', 'endDate', 'billingDay', 'gstPercent'] as const;

const monthKey = (d: Date): string => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const dateLabel = (d: Date): string =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** Today as UTC midnight — dates are stored as UTC midnight of the calendar day. */
const utcToday = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly model: Model<ContractDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    private readonly invoicesSvc: InvoicesService,
    private readonly events: EventEmitter2,
  ) {}

  list(q: ListContractsQuery = {}): Promise<ContractDocument[]> {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (q.clientId) filter.clientId = new Types.ObjectId(q.clientId);
    if (q.status) filter.status = q.status;
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  /** Contracts as JSON with their billing summary attached. */
  async withBilling(docs: ContractDocument[]): Promise<Record<string, unknown>[]> {
    const billing = await this.billing(docs);
    return docs.map((d) => ({
      ...(d.toJSON() as Record<string, unknown>),
      billing: billing.get(d.id as string) ?? { billedPaise: 0, paidPaise: 0, invoiceCount: 0, billedMonths: [] },
    }));
  }

  async byId(id: string): Promise<ContractDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc)
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: 'Contract not found',
      });
    return doc;
  }

  async create(input: CreateContractInput, actorId?: string): Promise<ContractDocument> {
    await this.assertClient(input.clientId);
    const doc = new this.model({
      ...this.withoutNulls(input),
      clientId: new Types.ObjectId(input.clientId),
      currency: input.currency ?? 'INR',
    });
    await doc.save();
    emitAudit(this.events, { actorId, action: AuditAction.CONTRACT_CREATED, entity: 'contract', entityId: doc.id, summary: doc.name });
    return doc;
  }

  async update(id: string, input: UpdateContractInput, actorId?: string): Promise<ContractDocument> {
    const doc = await this.byId(id);
    const before = snapshot(doc);
    if (input.clientId && input.clientId !== doc.clientId.toString()) await this.assertClient(input.clientId);
    const { clientId, ...rest } = input;
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      if (v === null && (CLEARABLE as readonly string[]).includes(k)) doc.set(k, undefined);
      else doc.set(k, v);
    }
    if (clientId) doc.clientId = new Types.ObjectId(clientId);
    if (doc.startDate && doc.endDate && doc.endDate < doc.startDate) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'End date must be on or after the start date',
        details: { fieldErrors: { endDate: ['End date must be on or after the start date'] } },
      });
    }
    await doc.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.CONTRACT_UPDATED,
      entity: 'contract',
      entityId: id,
      summary: doc.name,
      before,
      after: snapshot(doc),
    });
    return doc;
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
    emitAudit(this.events, { actorId, action: AuditAction.CONTRACT_DELETED, entity: 'contract', entityId: id, summary: doc.name });
  }

  /** Generate a draft invoice for this contract for a given month (YYYY-MM). */
  async generateInvoice(id: string, input: GenerateContractInvoiceInput, actorId?: string): Promise<InvoiceDocument> {
    const contract = await this.byId(id);
    this.assertBillable(contract, input.month);
    return this.invoiceContracts(contract.clientId, [contract], input.month, input.gstPercent, actorId);
  }

  /**
   * Bill a client's retainers for one month on a single invoice, one line per
   * contract. Contracts already billed that month are skipped; with
   * `contractIds` omitted, every active contract of the client that runs in that month is included.
   */
  async generateClientInvoice(input: GenerateClientInvoiceInput, actorId?: string): Promise<InvoiceDocument> {
    const clientId = new Types.ObjectId(input.clientId);
    const filter: Record<string, unknown> = { clientId, deletedAt: { $exists: false } };
    if (input.contractIds) filter._id = { $in: input.contractIds.map((c) => new Types.ObjectId(c)) };
    else filter.status = ContractStatus.ACTIVE;
    let contracts = await this.model.find(filter).sort({ createdAt: 1 }).exec();
    if (input.contractIds && contracts.length !== input.contractIds.length) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: 'Some contracts were not found for this client',
      });
    }
    if (input.contractIds) contracts.forEach((c) => this.assertBillable(c, input.month));
    else contracts = contracts.filter((c) => this.billableProblem(c, input.month) === undefined);
    if (contracts.length === 0) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `No active contracts to bill for ${monthLabel(input.month)}`,
      });
    }

    const { start, end } = this.monthRange(input.month);
    const billed = await this.billedContractIds(contracts.map((c) => c._id as Types.ObjectId), start, end);
    const due = contracts.filter((c) => !billed.has(c.id as string));
    if (due.length === 0) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `${monthLabel(input.month)} is already invoiced for ${contracts.length === 1 ? 'this contract' : 'these contracts'}`,
      });
    }
    return this.invoiceContracts(clientId, due, input.month, input.gstPercent, actorId);
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

  private withoutNulls<T extends object>(input: T): Partial<T> {
    return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
  }

  /** Why this contract can't be billed for `month`, or undefined when it can. */
  private billableProblem(c: ContractDocument, month: string): string | undefined {
    if (c.status === ContractStatus.PAUSED) return `"${c.name}" is paused. Set it back to active before billing it.`;
    if (c.status === ContractStatus.COMPLETED)
      return `"${c.name}" has ended. Set it back to active if you need to bill it again.`;
    if (c.startDate && month < monthKey(c.startDate))
      return `"${c.name}" starts on ${dateLabel(c.startDate)} — there's nothing to bill for ${monthLabel(month)}.`;
    if (c.endDate && month > monthKey(c.endDate))
      return `"${c.name}" ended on ${dateLabel(c.endDate)} — ${monthLabel(month)} is after the contract end.`;
    return undefined;
  }

  private assertBillable(c: ContractDocument, month: string): void {
    const problem = this.billableProblem(c, month);
    if (problem) throw new ConflictException({ code: ErrorCodes.CONFLICT, message: problem });
  }

  /** Issue one draft invoice billing each contract's monthly amount as its own line. */
  private async invoiceContracts(
    clientId: Types.ObjectId,
    contracts: ContractDocument[],
    month: string,
    gstPercent: number | undefined,
    actorId: string | undefined,
  ): Promise<InvoiceDocument> {
    const { start, end } = this.monthRange(month);
    // One invoice per contract per month, whether it was billed alone or combined.
    const billed = await this.billedContractIds(contracts.map((c) => c._id as Types.ObjectId), start, end);
    if (billed.size > 0) {
      const names = contracts.filter((c) => billed.has(c.id as string)).map((c) => c.name);
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `${monthLabel(month)} is already invoiced for ${names.join(', ')}. Open the existing invoice, or delete it first to regenerate.`,
      });
    }

    const currencies = new Set(contracts.map((c) => c.currency));
    if (currencies.size > 1) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: 'Contracts in different currencies cannot share an invoice',
      });
    }
    const currency = contracts[0]!.currency;

    const client = await this.clients.findOne({ _id: clientId, deletedAt: { $exists: false } }).exec();
    if (!client) {
      throw new NotFoundException({
        code: ErrorCodes.CLIENT_NOT_FOUND,
        message: "This contract's client was deleted. Move the contract to another client before billing it.",
      });
    }

    // Issue on the billing day of that month (or today, if that has already passed this month);
    // always inside the month so the "already billed" check finds it.
    const today = utcToday();
    const [y, m] = month.split('-').map(Number);
    const day = Math.min(...contracts.map((c) => c.billingDay ?? 1));
    let issueDate = new Date(Date.UTC(y!, m! - 1, day));
    if (issueDate < today && today < end) issueDate = today;
    // Due after the client's payment terms. Back-billing an old month still gives them the full terms from today.
    const terms = client.paymentTermsDays ?? 15;
    let dueDate = new Date(issueDate.getTime() + terms * DAY_MS);
    if (dueDate < today) dueDate = new Date(today.getTime() + terms * DAY_MS);

    // GST: what the user picked, else the contracts' own rate, else 18% for INR (0 for export billing).
    const rates = new Set(contracts.map((c) => c.gstPercent).filter((r): r is number => typeof r === 'number'));
    const gst = gstPercent ?? (rates.size === 1 ? [...rates][0]! : currency === 'INR' ? 18 : 0);

    const only = contracts.length === 1 ? contracts[0] : undefined;
    const invoice = await this.invoicesSvc.create({
      clientId: clientId.toString(),
      contractId: only?.id as string | undefined,
      lineItems: contracts.map((c) => ({
        description: `${c.name} — ${monthLabel(month)}`,
        qty: 1,
        unitPaise: c.monthlyAmountPaise,
        contractId: c.id as string,
      })),
      currency,
      gstPercent: gst,
      issueDate,
      dueDate,
      notes: `Retainer for ${monthLabel(month)}: ${contracts.map((c) => c.name).join(', ')}`,
    }, actorId ? { sub: actorId } : undefined);
    for (const c of contracts) {
      emitAudit(this.events, {
        actorId,
        action: AuditAction.CONTRACT_INVOICED,
        entity: 'contract',
        entityId: c.id as string,
        summary: `${invoice.number} · ${c.name} · ${monthLabel(month)}`,
      });
    }
    return invoice;
  }

  /** Contracts among `ids` that already have a live (not deleted) invoice issued in [start, end). */
  private async billedContractIds(ids: Types.ObjectId[], start: Date, end: Date): Promise<Set<string>> {
    const found = await this.invoices
      .find({
        deletedAt: { $exists: false },
        issueDate: { $gte: start, $lt: end },
        $or: [{ contractId: { $in: ids } }, { 'lineItems.contractId': { $in: ids } }],
      })
      .select('contractId lineItems.contractId')
      .lean()
      .exec();
    const wanted = new Set(ids.map((id) => id.toString()));
    const billed = new Set<string>();
    for (const inv of found) {
      for (const id of [inv.contractId, ...inv.lineItems.map((li) => li.contractId)]) {
        if (id && wanted.has(id.toString())) billed.add(id.toString());
      }
    }
    return billed;
  }

  /**
   * Per-contract billing totals. A combined invoice bills each contract through its own lines,
   * so it counts only that share (payments split in the same proportion).
   */
  private async billing(contracts: ContractDocument[]): Promise<Map<string, ContractBilling>> {
    const out = new Map<string, ContractBilling>();
    if (contracts.length === 0) return out;
    const ids = contracts.map((c) => c._id as Types.ObjectId);
    const wanted = new Set(ids.map((id) => id.toString()));
    const invoices = await this.invoices
      .find({
        deletedAt: { $exists: false },
        $or: [{ contractId: { $in: ids } }, { 'lineItems.contractId': { $in: ids } }],
      })
      .select('contractId lineItems subTotalPaise totalPaise paidPaise status issueDate')
      .lean()
      .exec();
    for (const inv of invoices) {
      const involved = new Set<string>();
      for (const li of inv.lineItems) if (li.contractId && wanted.has(li.contractId.toString())) involved.add(li.contractId.toString());
      if (inv.contractId && wanted.has(inv.contractId.toString())) involved.add(inv.contractId.toString());
      for (const cid of involved) {
        const lines = inv.lineItems.filter((li) => li.contractId?.toString() === cid);
        const lineTotal = lines.reduce((s, li) => s + Math.round(li.qty * li.unitPaise), 0);
        const ratio = lines.length === 0 ? 1 : inv.subTotalPaise > 0 ? lineTotal / inv.subTotalPaise : 0;
        const b = out.get(cid) ?? { billedPaise: 0, paidPaise: 0, invoiceCount: 0, billedMonths: [] };
        b.invoiceCount += 1;
        if (inv.issueDate) {
          const key = monthKey(new Date(inv.issueDate));
          if (!b.billedMonths.includes(key)) b.billedMonths.push(key);
        }
        if (!NOT_BILLED.includes(inv.status)) {
          b.billedPaise += Math.round(inv.totalPaise * ratio);
          b.paidPaise += Math.round(inv.paidPaise * ratio);
        }
        out.set(cid, b);
      }
    }
    return out;
  }

  /** UTC bounds of a YYYY-MM month — issue dates are stored as UTC midnight. */
  private monthRange(month: string): { start: Date; end: Date } {
    const [y, m] = month.split('-').map(Number);
    return { start: new Date(Date.UTC(y!, m! - 1, 1)), end: new Date(Date.UTC(y!, m!, 1)) };
  }
}
