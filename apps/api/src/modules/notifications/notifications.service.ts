// NotificationsService — create + inbox + mark-read.
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { EVENT_NAMES, type CreateNotificationInput } from '@agency/shared';

import { Notification, type NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
  ) {}

  inbox(userId: string, opts: { limit?: number } = {}): Promise<NotificationDocument[]> {
    return this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(opts.limit ?? 50)
      .exec();
  }

  unreadCount(userId: string): Promise<number> {
    return this.model.countDocuments({ userId, readAt: { $exists: false } }).exec();
  }

  markRead(userId: string, ids: string[]): Promise<{ matched: number }> {
    return this.model
      .updateMany(
        { _id: { $in: ids }, userId, readAt: { $exists: false } },
        { readAt: new Date() },
      )
      .exec()
      .then((res) => ({ matched: res.matchedCount }));
  }

  markAllRead(userId: string): Promise<{ matched: number }> {
    return this.model
      .updateMany({ userId, readAt: { $exists: false } }, { readAt: new Date() })
      .exec()
      .then((res) => ({ matched: res.matchedCount }));
  }

  create(input: CreateNotificationInput): Promise<NotificationDocument> {
    return this.model.create({
      ...input,
      userId: new Types.ObjectId(input.userId),
    });
  }

  createMany(inputs: CreateNotificationInput[]): Promise<NotificationDocument[]> {
    if (inputs.length === 0) return Promise.resolve([]);
    return this.model.insertMany(
      inputs.map((i) => ({ ...i, userId: new Types.ObjectId(i.userId) })),
    ) as unknown as Promise<NotificationDocument[]>;
  }

  @OnEvent(EVENT_NAMES.notification.create)
  async handleEvent(payload: CreateNotificationInput) {
    await this.create(payload);
  }
}
