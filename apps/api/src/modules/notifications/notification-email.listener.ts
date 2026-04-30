// Bridges in-app notifications to email for high-signal types.
// Listens for 'notification.create' events; when type is in the email list, sends mail.
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  EVENT_NAMES,
  NotificationType,
  type CreateNotificationInput,
} from '@agency/shared';

import { MailService } from '../mail/mail.service';
import { UsersRepository } from '../users/users.repository';

const EMAIL_TYPES = new Set<NotificationType>([
  NotificationType.LEAVE_APPROVED,
  NotificationType.LEAVE_REJECTED,
  NotificationType.PAYSLIP_GENERATED,
  NotificationType.ANNOUNCEMENT_POSTED,
  NotificationType.INVOICE_OVERDUE,
  NotificationType.TASK_ASSIGNED,
]);

@Injectable()
export class NotificationEmailListener {
  private readonly logger = new Logger(NotificationEmailListener.name);

  constructor(
    private readonly mail: MailService,
    private readonly users: UsersRepository,
  ) {}

  @OnEvent(EVENT_NAMES.notification.create, { async: true })
  async onNotification(payload: CreateNotificationInput): Promise<void> {
    if (!EMAIL_TYPES.has(payload.type)) return;
    try {
      const user = await this.users.byId(payload.userId);
      if (!user || !user.email) return;
      await this.mail.send({
        to: user.email,
        subject: payload.title || 'Agency panel notification',
        html: this.renderHtml(payload),
      });
    } catch (err) {
      this.logger.warn(`email notification failed: ${(err as Error).message}`);
    }
  }

  private renderHtml(p: CreateNotificationInput): string {
    const link = p.linkPath
      ? `<p><a href="${process.env.WEB_BASE_URL ?? ''}${p.linkPath}">View in panel</a></p>`
      : '';
    return `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px">${escape(p.title)}</h2>
        <p style="line-height:1.5;color:#444">${escape(p.body ?? '')}</p>
        ${link}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="font-size:12px;color:#888">You are receiving this because you are a member of the agency workspace.</p>
      </div>
    `;
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
