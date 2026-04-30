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
    this.from = this.config.getOrThrow<string>('mail.from');
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
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
    } catch (err) {
      this.logger.error(`mail send failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async sendInvite(to: string, name: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'You have been invited to the agency panel',
      html: `<p>Hi ${name},</p><p>You have been invited. Click below to set your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 72 hours.</p>`,
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
