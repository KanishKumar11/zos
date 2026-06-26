// InvoicesService — financial CRUD + payment + overdue cron + PDF + dashboard.
import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  EVENT_NAMES,
  InvoiceStatus,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Client, type ClientDocument } from '../clients/schemas/client.schema';
import { PdfService } from '../pdf/pdf.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { Invoice, type InvoiceDocument } from './schemas/invoice.schema';
import { renderInvoiceHtml } from './templates/invoice.template';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly model: Model<InvoiceDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    private readonly events: EventEmitter2,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  list(filter: { status?: InvoiceStatus; clientId?: string; projectId?: string; contractId?: string } = {}): Promise<InvoiceDocument[]> {
    const q: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.status) q.status = filter.status;
    if (filter.clientId) q.clientId = new Types.ObjectId(filter.clientId);
    if (filter.projectId) q.projectId = new Types.ObjectId(filter.projectId);
    if (filter.contractId) q.contractId = new Types.ObjectId(filter.contractId);
    return this.model.find(q).sort({ createdAt: -1 }).limit(500).exec();
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

  private computeTotals(doc: InvoiceDocument): void {
    const subTotal = doc.lineItems.reduce(
      (acc, li) => acc + Math.round(li.qty * li.unitPaise),
      0,
    );
    const gst = Math.round((subTotal * (doc.gstPercent ?? 0)) / 100);
    doc.subTotalPaise = subTotal;
    doc.gstPaise = gst;
    doc.totalPaise = subTotal + gst;
    doc.paidPaise = doc.payments.reduce((acc, p) => acc + p.amountPaise, 0);
  }

  private updateStatusByPayments(doc: InvoiceDocument): void {
    if (doc.paidPaise >= doc.totalPaise && doc.totalPaise > 0) {
      doc.status = InvoiceStatus.PAID;
    } else if (doc.paidPaise > 0 && doc.status !== InvoiceStatus.DRAFT) {
      doc.status = InvoiceStatus.PARTIAL;
    } else if (doc.paidPaise === 0 && doc.status !== InvoiceStatus.DRAFT) {
      const overdue = doc.dueDate && doc.dueDate < new Date();
      doc.status = overdue ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT;
    }
  }

  async create(input: CreateInvoiceInput): Promise<InvoiceDocument> {
    const issueDate = input.issueDate ? new Date(input.issueDate as unknown as string) : new Date();
    const year = issueDate.getFullYear();
    let number = input.number;
    if (!number) {
      const prefix = `ZLK-${year}-`;
      const last = await this.model
        .findOne({ number: { $regex: `^ZLK-${year}-\\d+$` } })
        .sort({ number: -1 })
        .select('number')
        .lean()
        .exec();
      const seq = last?.number ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
      number = `${prefix}${String(seq).padStart(4, '0')}`;
    }
    const doc = new this.model({
      ...input,
      number,
      clientId: new Types.ObjectId(input.clientId),
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      contractId: input.contractId ? new Types.ObjectId(input.contractId) : undefined,
      status: InvoiceStatus.DRAFT,
      currency: input.currency ?? 'INR',
      issueDate,
    });
    this.computeTotals(doc);
    return doc.save();
  }

  async update(id: string, input: UpdateInvoiceInput): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    Object.assign(doc, input);
    if (input.clientId) doc.clientId = new Types.ObjectId(input.clientId);
    if (input.projectId) doc.projectId = new Types.ObjectId(input.projectId);
    if (input.contractId) doc.contractId = new Types.ObjectId(input.contractId);
    this.computeTotals(doc);
    this.updateStatusByPayments(doc);
    return doc.save();
  }

  async send(id: string): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    doc.status = InvoiceStatus.SENT;
    if (!doc.issueDate) doc.issueDate = new Date();
    return doc.save();
  }

  async recordPayment(id: string, input: RecordPaymentInput): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    doc.payments.push({
      paidAt: new Date(input.paidAt),
      amountPaise: input.amountPaise,
      reference: input.reference ?? '',
      method: input.method ?? '',
    } as never);
    this.computeTotals(doc);
    this.updateStatusByPayments(doc);
    return doc.save();
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }

  /** Hourly check for overdue invoices; fanout notifications. */
  @Cron(CronExpression.EVERY_HOUR)
  async markOverdue(): Promise<void> {
    const now = new Date();
    const candidates = await this.model
      .find({
        deletedAt: { $exists: false },
        status: { $in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL] },
        dueDate: { $lt: now },
      })
      .exec();
    for (const inv of candidates) {
      inv.status = InvoiceStatus.OVERDUE;
      await inv.save();
      this.events.emit(EVENT_NAMES.invoice.overdue, {
        invoiceId: inv.id,
        clientId: inv.clientId.toString(),
        totalPaise: inv.totalPaise,
      });
    }
  }

  // -- PDF -----------------------------------------------------------------

  async invoicePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const inv = await this.byId(id);
    const client = await this.clients.findById(inv.clientId).exec();
    const settings = await this.settings.get();
    const html = renderInvoiceHtml({
      agency: {
        name: settings.workspaceName,
        address: [settings.addressLine1, settings.city, settings.state].filter(Boolean).join(', ') || undefined,
        gstin: settings.gstin,
        pan: settings.pan,
      },
      client: {
        name: client?.name ?? 'Client',
        gstin: client?.gstin || undefined,
        address: client?.address || undefined,
      },
      number: inv.number,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      currency: inv.currency,
      lineItems: inv.lineItems.map((li) => ({
        description: li.description,
        qty: li.qty,
        unitPaise: li.unitPaise,
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
        method: p.method || undefined,
      })),
    });
    const buffer = await this.pdf.renderPdf(html);
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

  // -- Dashboard / aging ---------------------------------------------------

  async dashboard(): Promise<{
    billedPaise: number;
    collectedPaise: number;
    outstandingPaise: number;
    overduePaise: number;
    counts: Record<string, number>;
  }> {
    const all = await this.model.find({ deletedAt: { $exists: false } }).exec();
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    const counts: Record<string, number> = {};
    for (const inv of all) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
      if (inv.status === InvoiceStatus.DRAFT) continue;
      billed += inv.totalPaise;
      collected += inv.paidPaise;
      if (inv.status !== InvoiceStatus.WRITTEN_OFF) {
        const open = Math.max(0, inv.totalPaise - inv.paidPaise);
        outstanding += open;
        if (inv.status === InvoiceStatus.OVERDUE) overdue += open;
      }
    }
    return { billedPaise: billed, collectedPaise: collected, outstandingPaise: outstanding, overduePaise: overdue, counts };
  }

  async aging(): Promise<{ range: string; countInvoices: number; openPaise: number }[]> {
    const now = Date.now();
    const open = await this.model
      .find({
        deletedAt: { $exists: false },
        status: { $in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
      })
      .exec();
    const buckets = [
      { range: '0-30', max: 30, count: 0, paise: 0 },
      { range: '31-60', max: 60, count: 0, paise: 0 },
      { range: '61-90', max: 90, count: 0, paise: 0 },
      { range: '90+', max: Infinity, count: 0, paise: 0 },
    ];
    for (const inv of open) {
      const anchor = inv.dueDate ?? inv.issueDate;
      if (!anchor) continue;
      const days = Math.max(0, Math.floor((now - new Date(anchor).getTime()) / 86_400_000));
      const bucket = buckets.find((b) => days <= b.max)!;
      bucket.count++;
      bucket.paise += inv.totalPaise - inv.paidPaise;
    }
    return buckets.map((b) => ({ range: b.range, countInvoices: b.count, openPaise: b.paise }));
  }
}
