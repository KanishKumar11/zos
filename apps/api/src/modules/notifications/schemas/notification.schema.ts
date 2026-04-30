// Notification — per-user inbox entry.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { NotificationType } from '@agency/shared';

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type!: NotificationType;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) body!: string;
  @Prop({ type: Object, default: {} }) data!: Record<string, unknown>;
  @Prop() linkPath?: string;
  @Prop({ type: Date, index: true }) readAt?: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
