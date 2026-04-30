// InvoicesService — financial CRUD + payment + overdue cron.
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

import { Invoice, type InvoiceDocument } from './schemas/invoice.schema';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly model: Model<InvoiceDocument>,
    private readonly events: EventEmitter2,
  ) {}

  list(filter: { status?: InvoiceStatus; clientId?: string } = {}): Promise<InvoiceDocument[]> {
    const q: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.status) q.status = filter.status;
    if (filter.clientId) q.clientId = new Types.ObjectId(filter.clientId);
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
    if (doc.status === InvoiceStatus.DRAFT) return;
    if (doc.paidPaise === 0) {
      const overdue = doc.dueDate && doc.dueDate < new Date();
      doc.status = overdue ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT;
    } else if (doc.paidPaise >= doc.totalPaise) {
      doc.status = InvoiceStatus.PAID;
    } else {
      doc.status = InvoiceStatus.PARTIAL;
    }
  }

  async create(input: CreateInvoiceInput): Promise<InvoiceDocument> {
    const doc = new this.model({
      ...input,
      clientId: new Types.ObjectId(input.clientId),
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      status: InvoiceStatus.DRAFT,
      currency: input.currency ?? 'INR',
    });
    this.computeTotals(doc);
    return doc.save();
  }

  async update(id: string, input: UpdateInvoiceInput): Promise<InvoiceDocument> {
    const doc = await this.byId(id);
    Object.assign(doc, input);
    if (input.clientId) doc.clientId = new Types.ObjectId(input.clientId);
    if (input.projectId) doc.projectId = new Types.ObjectId(input.projectId);
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
}
