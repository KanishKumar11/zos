// Announcement schema — broadcasts to ALL/ROLE/DEPT/USERS audiences.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { AudienceType } from '@agency/shared';

@Schema({ timestamps: true, collection: 'announcements' })
export class Announcement {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
  @Prop({ type: String, enum: Object.values(AudienceType), default: AudienceType.ALL, index: true })
  audienceType!: AudienceType;
  @Prop({ type: [MS.Types.ObjectId], default: [] }) audienceIds!: Types.ObjectId[];
  @Prop({ default: false }) pinned!: boolean;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) createdBy!: Types.ObjectId;
  @Prop({ type: Date }) publishedAt?: Date;
}

export type AnnouncementDocument = HydratedDocument<Announcement>;
export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);
