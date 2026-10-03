// PortalService — everything a client's users can see, always scoped to their own client company.
// Never returns team pay, agreed fees, margins, internal updates/files or draft invoices.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { InvoiceStatus, ProjectMemberRole, Role } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Client, type ClientDocument } from '../clients/schemas/client.schema';
import { CollabService } from '../collab/collab.service';
import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { balanceOf, isOverdue, normalizeStatus } from '../invoices/invoice.rules';
import { InvoicesService } from '../invoices/invoices.service';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';

/** Invoices a client may see: anything that has actually been issued. */
const VISIBLE_INVOICE = { status: { $ne: InvoiceStatus.DRAFT }, deletedAt: { $exists: false } };

@Injectable()
export class PortalService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    private readonly collab: CollabService,
    private readonly invoicesSvc: InvoicesService,
  ) {}

  /** Resolve the signed-in portal user's client. Re-checked on every request. */
  async clientIdFor(userId: string): Promise<string> {
    const user = await this.users.findOne({ _id: userId, role: Role.CLIENT, deletedAt: { $exists: false } }).select('clientId').exec();
    if (!user?.clientId) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: "Your portal login isn't linked to a client. Please contact us." });
    }
    return user.clientId.toString();
  }

  async me(userId: string) {
    const clientId = await this.clientIdFor(userId);
    const [user, client, colleagues] = await Promise.all([
      this.users.findById(userId).select('name email phone title').exec(),
      this.clients.findById(clientId).select('name').exec(),
      this.users
        .find({ role: Role.CLIENT, clientId: new Types.ObjectId(clientId), deletedAt: { $exists: false }, status: 'ACTIVE' })
        .select('name email title')
        .exec(),
    ]);
    return {
      user: { id: userId, name: user?.name, email: user?.email, phone: user?.phone, title: user?.title },
      client: { id: clientId, name: client?.name ?? 'Your company' },
      colleagues: colleagues.filter((c) => c.id !== userId).map((c) => ({ name: c.name, email: c.email, title: c.title })),
    };
  }

  private projectFilter(clientId: string) {
    return { clientId: new Types.ObjectId(clientId), portalVisible: { $ne: false }, deletedAt: { $exists: false } };
  }

  async summary(clientId: string) {
    const fyStart = (() => {
      const now = new Date();
      return now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
    })();
    const [projects, invoices] = await Promise.all([
      this.projectModel.find(this.projectFilter(clientId)).select('name status').exec(),
      this.invoiceModel.find({ clientId: new Types.ObjectId(clientId), ...VISIBLE_INVOICE }).exec(),
    ]);
    const open = invoices.filter((i) => balanceOf(i) > 0);
    const outstandingPaise = open.reduce((s, i) => s + balanceOf(i), 0);
    const overdue = open.filter((i) => isOverdue(i));
    const paidThisFyPaise = invoices
      .flatMap((i) => (i.payments ?? []) as unknown as { paidAt: Date; amountPaise: number }[])
      .filter((p) => p.paidAt >= fyStart)
      .reduce((s, p) => s + p.amountPaise, 0);
    const nextDue = open
      .filter((i) => i.dueDate)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];

    const updates = (
      await Promise.all(
        projects.map(async (p) =>
          (await this.collab.listUpdates(p.id, { clientOnly: true }))
            .slice(0, 5)
            // Strip internal author/uploader ids, as on the project page.
            .map(({ authorId: _a, ...u }) => ({ ...u, files: u.files.map(({ uploadedBy: _u, ...f }) => f), projectName: p.name })),
        ),
      )
    )
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      activeProjects: projects.filter((p) => p.status !== 'COMPLETED').length,
      totalProjects: projects.length,
      outstandingPaise,
      overduePaise: overdue.reduce((s, i) => s + balanceOf(i), 0),
      overdueCount: overdue.length,
      paidThisFyPaise,
      nextDue: nextDue
        ? { invoiceId: nextDue.id, number: nextDue.number, dueDate: nextDue.dueDate, balancePaise: nextDue.totalPaise - nextDue.paidPaise, currency: nextDue.currency }
        : null,
      recentUpdates: updates,
    };
  }

  async projects(clientId: string) {
    const docs = await this.projectModel.find(this.projectFilter(clientId)).sort({ createdAt: -1 }).exec();
    // One lookup for every project lead, so the portal can show "your contact" without N queries.
    const leadIds = [...new Set(docs.map((p) => leadOf(p)).filter(Boolean) as string[])];
    const leads = leadIds.length
      ? await this.users.find({ _id: { $in: leadIds }, deletedAt: { $exists: false } }).select('name email title').exec()
      : [];
    const leadById = new Map(leads.map((u) => [u.id as string, u]));
    return docs.map((p) => {
      const ms = p.milestones ?? [];
      const done = ms.filter((m) => m.status === 'COLLECTED' || m.status === 'INVOICED').length;
      const next = ms
        .filter((m) => m.status === 'PENDING')
        .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0];
      const lead = leadById.get(leadOf(p) ?? '');
      return {
        _id: p.id as string,
        name: p.name,
        code: p.code,
        status: p.status,
        description: p.description,
        startDate: p.startDate,
        endDate: p.endDate,
        milestoneCount: ms.length,
        milestonesDone: done,
        nextMilestone: next ? { name: next.name, dueDate: next.dueDate } : null,
        // The journey only: names, dates and state. Amounts live on the project page.
        milestones: ms.map((m) => ({ name: m.name, dueDate: m.dueDate, status: m.status })),
        lead: lead ? { name: lead.name, email: lead.email, title: lead.title } : null,
      };
    });
  }

  /**
   * One project as the client sees it. `includeHidden` is only for the owner's preview of a project
   * that is switched off in the portal; the lookup is still scoped to the given client.
   */
  async project(clientId: string, projectId: string, opts: { includeHidden?: boolean } = {}) {
    const p = opts.includeHidden ? await this.projectOfClient(clientId, projectId) : await this.collab.projectForClient(projectId, clientId);
    const leadId = leadOf(p);
    const memberIds = [...new Set((p.members ?? []).map((m) => m.userId?.toString()).filter(Boolean) as string[])];
    const [people, updates, files, invoices] = await Promise.all([
      memberIds.length
        ? this.users.find({ _id: { $in: memberIds }, deletedAt: { $exists: false } }).select('name email title').exec()
        : [],
      this.collab.listUpdates(p.id, { clientOnly: true }),
      this.collab.listFiles(p.id, { clientOnly: true }),
      this.invoiceModel
        .find({ clientId: new Types.ObjectId(clientId), ...VISIBLE_INVOICE, $or: [{ projectId: p._id }, { 'lineItems.projectId': p._id }] })
        .select('number status')
        .exec(),
    ]);
    const invoiceById = new Map(invoices.map((i) => [i.id as string, i]));
    const personById = new Map(people.map((u) => [u.id as string, u]));
    const lead = leadId ? personById.get(leadId) : undefined;
    // Who's on the project: names and job titles only — never ids, roles' pay or agreed fees.
    const team = memberIds
      .map((id) => personById.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ name: u.name, title: u.title, lead: u.id === leadId }))
      .sort((a, b) => Number(b.lead) - Number(a.lead));
    return {
      _id: p.id as string,
      name: p.name,
      code: p.code,
      status: p.status,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      currency: p.currency ?? 'INR',
      lead: lead ? { name: lead.name, email: lead.email } : null,
      team,
      milestones: (p.milestones ?? []).map((m) => {
        const inv = m.invoiceId ? invoiceById.get(m.invoiceId.toString()) : undefined;
        return {
          _id: (m as unknown as { _id: Types.ObjectId })._id.toString(),
          name: m.name,
          amountPaise: m.amountPaise,
          dueDate: m.dueDate,
          status: m.status,
          invoice: inv ? { _id: inv.id as string, number: inv.number, status: inv.status } : null,
        };
      }),
      // Strip internal author ids; clients only need a name.
      updates: updates.map(({ authorId: _a, ...u }) => ({ ...u, files: u.files.map(({ uploadedBy: _u, ...f }) => f) })),
      files: files.map(({ uploadedBy: _u, ...f }) => f),
    };
  }

  private async projectOfClient(clientId: string, projectId: string) {
    const doc = await this.projectModel.findOne({ _id: projectId, clientId: new Types.ObjectId(clientId), deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    return doc;
  }

  async fileUrl(clientId: string, projectId: string, fileId: string) {
    await this.collab.projectForClient(projectId, clientId);
    return this.collab.fileUrl(projectId, fileId, { clientOnly: true });
  }

  async invoices(clientId: string) {
    const docs = await this.invoiceModel
      .find({ clientId: new Types.ObjectId(clientId), ...VISIBLE_INVOICE })
      .sort({ issueDate: -1, createdAt: -1 })
      .exec();
    const projectIds = [...new Set(docs.flatMap((d) => [d.projectId, ...(d.lineItems ?? []).map((l) => l.projectId)]).filter(Boolean).map(String))];
    const projects = await this.projectModel.find({ _id: { $in: projectIds } }).select('name').exec();
    const names = new Map(projects.map((p) => [p.id as string, p.name]));
    return docs.map((d) => this.presentInvoice(d, names, false));
  }

  async invoice(clientId: string, invoiceId: string) {
    const doc = await this.invoiceFor(clientId, invoiceId);
    const projectIds = [d(doc.projectId), ...(doc.lineItems ?? []).map((l) => d(l.projectId))].filter(Boolean) as string[];
    const projects = await this.projectModel.find({ _id: { $in: projectIds } }).select('name').exec();
    const names = new Map(projects.map((p) => [p.id as string, p.name]));
    return this.presentInvoice(doc, names, true);
  }

  async invoicePdf(clientId: string, invoiceId: string) {
    await this.invoiceFor(clientId, invoiceId);
    return this.invoicesSvc.invoicePdf(invoiceId);
  }

  private async invoiceFor(clientId: string, invoiceId: string) {
    const doc = await this.invoiceModel
      .findOne({ _id: invoiceId, clientId: new Types.ObjectId(clientId), ...VISIBLE_INVOICE })
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.INVOICE_NOT_FOUND, message: 'Invoice not found' });
    return doc;
  }

  private presentInvoice(doc: InvoiceDocument, projectNames: Map<string, string>, detail: boolean) {
    const projectNamesOn = [...new Set([d(doc.projectId), ...(doc.lineItems ?? []).map((l) => d(l.projectId))].filter(Boolean) as string[])]
      .map((id) => projectNames.get(id))
      .filter(Boolean);
    const balance = balanceOf(doc);
    return {
      _id: doc.id as string,
      number: doc.number,
      status: isOverdue(doc) ? InvoiceStatus.OVERDUE : normalizeStatus(doc.status),
      issueDate: doc.issueDate,
      dueDate: doc.dueDate,
      currency: doc.currency,
      subTotalPaise: doc.subTotalPaise,
      gstPercent: doc.gstPercent,
      gstPaise: doc.gstPaise,
      totalPaise: doc.totalPaise,
      paidPaise: doc.paidPaise,
      balancePaise: Math.max(0, balance),
      projects: projectNamesOn,
      // The client's own payments against this invoice — the portal draws a payment timeline from them.
      payments: ((doc.payments ?? []) as unknown as { paidAt: Date; amountPaise: number; reference?: string; method?: string }[]).map((p) => ({
        paidAt: p.paidAt,
        amountPaise: p.amountPaise,
        reference: p.reference,
        method: p.method,
      })),
      ...(detail
        ? {
            lineItems: (doc.lineItems ?? []).map((l) => ({
              description: l.description,
              qty: l.qty,
              unitPaise: l.unitPaise,
              amountPaise: Math.round(l.qty * l.unitPaise),
            })),
            notes: doc.notes,
          }
        : {}),
    };
  }
}

const d = (id: Types.ObjectId | undefined | null) => (id ? id.toString() : undefined);

const leadOf = (p: { members?: { role: ProjectMemberRole; userId?: Types.ObjectId }[] }) =>
  p.members?.find((m) => m.role === ProjectMemberRole.LEAD)?.userId?.toString();
