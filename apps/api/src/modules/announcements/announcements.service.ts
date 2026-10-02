// AnnouncementsService — CRUD + audience fanout to notifications.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import {
  AudienceType,
  NotificationType,
  Role,
  canSignIn,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { NotificationsService } from '../notifications/notifications.service';
import { UsersRepository } from '../users/users.repository';
import { Announcement, type AnnouncementDocument } from './schemas/announcement.schema';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectModel(Announcement.name) private readonly model: Model<AnnouncementDocument>,
    private readonly users: UsersRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /** Announcements this viewer is in the audience for (owner/admin see everything). */
  private async audienceFilter(viewer: { sub: string; role: Role }): Promise<FilterQuery<AnnouncementDocument>> {
    if (viewer.role === Role.OWNER || viewer.role === Role.ADMIN) return {};
    const me = await this.users.byId(viewer.sub);
    const uid = new Types.ObjectId(viewer.sub);
    return {
      $or: [
        { audienceType: AudienceType.ALL },
        { audienceType: AudienceType.ROLE, audienceRoles: viewer.role },
        // Old ROLE posts stored role names in audienceIds and never matched anyone — show them to everyone.
        { audienceType: AudienceType.ROLE, audienceRoles: { $size: 0 } },
        ...(me?.departmentId ? [{ audienceType: AudienceType.DEPARTMENT, audienceIds: me.departmentId }] : []),
        { audienceType: AudienceType.USERS, audienceIds: uid },
        { createdBy: uid },
      ],
    };
  }

  async list(viewer: { sub: string; role: Role }) {
    const docs = await this.model.find(await this.audienceFilter(viewer)).sort({ pinned: -1, createdAt: -1 }).limit(200).exec();
    const isManager = viewer.role === Role.OWNER || viewer.role === Role.ADMIN;
    return docs.map((d) => {
      const json = d.toJSON() as Record<string, unknown>;
      // Others only learn whether *they* have read it.
      return isManager
        ? { ...json, readCount: d.readBy.length }
        : { ...json, readBy: d.readBy.filter((r) => r.userId.toString() === viewer.sub) };
    });
  }

  async byId(id: string, viewer?: { sub: string; role: Role }): Promise<AnnouncementDocument> {
    const filter = viewer ? await this.audienceFilter(viewer) : {};
    const doc = await this.model.findOne({ _id: id, ...filter }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Announcement not found' });
    return doc;
  }

  async create(input: CreateAnnouncementInput, actorId: string): Promise<AnnouncementDocument> {
    const doc = await this.model.create({
      title: input.title,
      body: input.body,
      audienceType: input.audienceType,
      audienceIds: (input.audienceIds ?? []).map((id) => new Types.ObjectId(id)),
      audienceRoles: input.audienceRoles ?? [],
      pinned: input.pinned ?? false,
      createdBy: new Types.ObjectId(actorId),
      publishedAt: new Date(),
    });
    await this.fanout(doc);
    return doc;
  }

  async update(id: string, input: UpdateAnnouncementInput): Promise<AnnouncementDocument> {
    const patch: Record<string, unknown> = { ...input };
    if (input.audienceIds) {
      patch.audienceIds = input.audienceIds.map((aid) => new Types.ObjectId(aid));
    }
    if (input.audienceRoles) patch.audienceRoles = input.audienceRoles;
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Announcement not found' });
    return doc;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Announcement not found' });
  }

  /** Mark announcement as read by user (idempotent). Returns updated readBy length. */
  async markRead(id: string, userId: string, role: Role): Promise<{ ok: true; readCount: number }> {
    const doc = await this.byId(id, { sub: userId, role });
    const uid = new Types.ObjectId(userId);
    const exists = doc.readBy.some((r) => r.userId.toString() === userId);
    if (!exists) {
      doc.readBy.push({ userId: uid, readAt: new Date() } as never);
      await doc.save();
    }
    return { ok: true, readCount: doc.readBy.length };
  }

  // --- audience resolution -------------------------------------------------

  private async resolveRecipients(doc: AnnouncementDocument): Promise<string[]> {
    const staff = (u: { role: Role; status: string }) => u.role !== Role.CLIENT && canSignIn(u.status as never);
    if (doc.audienceType === AudienceType.ALL) {
      const users = await this.users.list({}, { limit: 5000 });
      return users.filter(staff).map((u) => u.id);
    }
    if (doc.audienceType === AudienceType.USERS) {
      return doc.audienceIds.map((id) => id.toString());
    }
    if (doc.audienceType === AudienceType.ROLE) {
      const recipients = new Set<string>();
      for (const role of doc.audienceRoles ?? []) {
        const users = await this.users.list({ role }, { limit: 5000 });
        users.filter(staff).forEach((u) => recipients.add(u.id));
      }
      return [...recipients];
    }
    if (doc.audienceType === AudienceType.DEPARTMENT) {
      const recipients = new Set<string>();
      for (const dept of doc.audienceIds) {
        const users = await this.users.list({ departmentId: dept }, { limit: 5000 });
        users.filter(staff).forEach((u) => recipients.add(u.id));
      }
      return [...recipients];
    }
    return [];
  }

  private async fanout(doc: AnnouncementDocument): Promise<void> {
    const recipients = await this.resolveRecipients(doc);
    if (recipients.length === 0) return;
    await this.notifications.createMany(
      recipients.map((userId) => ({
        userId,
        type: NotificationType.ANNOUNCEMENT_POSTED,
        title: doc.title,
        body: toPlainText(doc.body).slice(0, 280),
        data: { announcementId: doc.id },
        linkPath: '/announcements',
      })),
    );
  }
}

/** Notification previews are plain text — drop tags and collapse whitespace. */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
