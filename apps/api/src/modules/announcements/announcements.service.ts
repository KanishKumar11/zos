// AnnouncementsService — CRUD + audience fanout to notifications.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AudienceType,
  NotificationType,
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

  list(): Promise<AnnouncementDocument[]> {
    return this.model.find().sort({ pinned: -1, createdAt: -1 }).exec();
  }

  async byId(id: string): Promise<AnnouncementDocument> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Announcement not found' });
    return doc;
  }

  async create(input: CreateAnnouncementInput, actorId: string): Promise<AnnouncementDocument> {
    const doc = await this.model.create({
      title: input.title,
      body: input.body,
      audienceType: input.audienceType,
      audienceIds: (input.audienceIds ?? []).map((id) => new Types.ObjectId(id)),
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
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Announcement not found' });
    return doc;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Announcement not found' });
  }

  // --- audience resolution -------------------------------------------------

  private async resolveRecipients(doc: AnnouncementDocument): Promise<string[]> {
    if (doc.audienceType === AudienceType.ALL) {
      const users = await this.users.list({}, { limit: 5000 });
      return users.map((u) => u.id);
    }
    if (doc.audienceType === AudienceType.USERS) {
      return doc.audienceIds.map((id) => id.toString());
    }
    if (doc.audienceType === AudienceType.ROLE) {
      const recipients = new Set<string>();
      for (const role of doc.audienceIds.map((r) => r.toString())) {
        const users = await this.users.list({ role }, { limit: 5000 });
        users.forEach((u) => recipients.add(u.id));
      }
      return [...recipients];
    }
    if (doc.audienceType === AudienceType.DEPARTMENT) {
      const recipients = new Set<string>();
      for (const dept of doc.audienceIds) {
        const users = await this.users.list({ departmentId: dept }, { limit: 5000 });
        users.forEach((u) => recipients.add(u.id));
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
        type: NotificationType.ANNOUNCEMENT,
        title: doc.title,
        body: doc.body.slice(0, 280),
        data: { announcementId: doc.id },
        linkPath: `/announcements/${doc.id}`,
      })),
    );
  }
}
