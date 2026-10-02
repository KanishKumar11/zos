// Announcement schema — broadcasts to ALL/ROLE/DEPT/USERS audiences.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { AudienceType } from '@agency/shared';

@Schema({ _id: false, timestamps: false })
export class AnnouncementReadReceipt {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ type: Date, required: true }) readAt!: Date;
}
const AnnouncementReadReceiptSchema = SchemaFactory.createForClass(AnnouncementReadReceipt);

@Schema({ timestamps: true, collection: 'announcements' })
export class Announcement {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
  @Prop({ type: String, enum: Object.values(AudienceType), default: AudienceType.ALL, index: true })
  audienceType!: AudienceType;
  /** DEPARTMENT → department ids, USERS → user ids. */
  @Prop({ type: [MS.Types.ObjectId], default: [] }) audienceIds!: Types.ObjectId[];
  /** ROLE audiences (role names). */
  @Prop({ type: [String], default: [] }) audienceRoles!: string[];
  @Prop({ default: false }) pinned!: boolean;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) createdBy!: Types.ObjectId;
  @Prop({ type: Date }) publishedAt?: Date;
  @Prop({ type: [AnnouncementReadReceiptSchema], default: [] }) readBy!: AnnouncementReadReceipt[];
}

export type AnnouncementDocument = HydratedDocument<Announcement>;
export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);
