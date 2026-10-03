// MailService — Nodemailer wrapper. Templates render via simple inline HTML for now;
// richer templates ship in Batch 11 (announcements/notifications) reusing this transport.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.getOrThrow<string>('mail.host');
    const port = this.config.getOrThrow<number>('mail.port');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    const from = this.config.getOrThrow<string>('mail.from').trim();
    // A bare display name ("Agency Panel") isn't a valid sender — pair it with the login address.
    this.from = from.includes('@') ? from : user ? `${from} <${user}>` : from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(args: SendArgs): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: args.to,
        cc: args.cc,
        replyTo: args.replyTo,
        attachments: args.attachments,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
    } catch (err) {
      this.logger.error(`mail send failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async sendInvite(to: string, name: string, link: string, opts: { portalFor?: string } = {}): Promise<void> {
    const safeName = escapeHtml(name);
    const intro = opts.portalFor
      ? `You've been given access to the client portal for <strong>${escapeHtml(opts.portalFor)}</strong>, where you can follow your projects, see shared updates and files, and view invoices.`
      : "You've been invited to join the team workspace.";
    await this.send({
      to,
      subject: opts.portalFor ? `Your client portal access — ${opts.portalFor}` : 'You have been invited to the agency workspace',
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <p>Hi ${safeName},</p><p>${intro}</p>
        <p><a href="${link}" style="display:inline-block;background:#a8502b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Set your password</a></p>
        <p style="color:#666;font-size:13px">Or paste this link into your browser: ${link}<br/>The link expires in 72 hours.</p></div>`,
    });
  }

  async sendInvoice(args: {
    to: string[];
    cc?: string;
    agencyName: string;
    clientName: string;
    number: string;
    totalLabel: string;
    balanceLabel: string;
    dueLabel?: string;
    notes?: string;
    pdf: { filename: string; content: Buffer };
  }): Promise<void> {
    const due = args.dueLabel ? ` Payment is due by <strong>${escapeHtml(args.dueLabel)}</strong>.` : '';
    const note = args.notes?.trim() ? `<p style="color:#444">${escapeHtml(args.notes.trim())}</p>` : '';
    await this.send({
      to: args.to,
      cc: args.cc,
      replyTo: args.cc,
      subject: `Invoice ${args.number} from ${args.agencyName}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <p>Hi ${escapeHtml(args.clientName)},</p>
        <p>Please find attached invoice <strong>${escapeHtml(args.number)}</strong> for <strong>${escapeHtml(args.totalLabel)}</strong>${args.balanceLabel !== args.totalLabel ? ` (balance ${escapeHtml(args.balanceLabel)})` : ''}.${due}</p>
        ${note}
        <p>If you have any questions, just reply to this email.</p>
        <p style="color:#666;font-size:13px">Thank you,<br/>${escapeHtml(args.agencyName)}</p></div>`,
      text: `Hi ${args.clientName},

Please find attached invoice ${args.number} for ${args.totalLabel}.${args.dueLabel ? ` Due by ${args.dueLabel}.` : ''}

Thank you,
${args.agencyName}`,
      attachments: [{ filename: args.pdf.filename, content: args.pdf.content, contentType: 'application/pdf' }],
    });
  }

  async sendResetLink(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your agency panel password',
      html: `<p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 2 hours. Ignore if you did not request this.</p>`,
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
