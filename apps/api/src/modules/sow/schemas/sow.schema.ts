// SOW schema — financials are OWNER-only (enforced at service layer).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { MilestoneStatus } from '@agency/shared';

@Schema({ _id: false })
export class SowMilestone {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ type: Date }) dueDate?: Date;
  @Prop({ type: String, enum: Object.values(MilestoneStatus), default: MilestoneStatus.PENDING })
  status!: MilestoneStatus;
}
const SowMilestoneSchema = SchemaFactory.createForClass(SowMilestone);

@Schema({ _id: false })
export class SowBrief {
  @Prop({ required: true }) scopeSummary!: string;
  @Prop({ type: [String], default: [] }) deliverables!: string[];
  @Prop({ type: Date }) timelineStart?: Date;
  @Prop({ type: Date }) timelineEnd?: Date;
  @Prop({ type: Number, default: 0 }) revisionRounds!: number;
  @Prop({ type: Date }) publishedAt?: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) publishedBy?: Types.ObjectId;
}
const SowBriefSchema = SchemaFactory.createForClass(SowBrief);

@Schema({ timestamps: true, collection: 'sows' })
export class Sow {
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Project', index: true }) projectId?: Types.ObjectId;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: [SowMilestoneSchema], default: [] }) milestones!: SowMilestone[];
  @Prop({ required: true, type: Number }) totalValuePaise!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: String }) documentKey?: string;
  @Prop({ type: SowBriefSchema }) brief?: SowBrief;
  @Prop({ type: Date }) signedAt?: Date;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type SowDocument = HydratedDocument<Sow>;
export const SowSchema = SchemaFactory.createForClass(Sow);
