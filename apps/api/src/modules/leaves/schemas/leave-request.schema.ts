// LeaveRequest — request -> approval workflow.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { LeaveStatus, LeaveType } from '@agency/shared';

@Schema({ timestamps: true, collection: 'leave_requests' })
export class LeaveRequest {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(LeaveType), required: true })
  type!: LeaveType;
  @Prop({ required: true, type: Date }) startDate!: Date;
  @Prop({ required: true, type: Date }) endDate!: Date;
  /** Inclusive day count (excludes weekends + holidays). */
  @Prop({ required: true, type: Number }) days!: number;
  @Prop({ required: true }) reason!: string;
  @Prop({ type: String, enum: Object.values(LeaveStatus), default: LeaveStatus.PENDING, index: true })
  status!: LeaveStatus;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) decidedBy?: Types.ObjectId;
  @Prop({ type: Date }) decidedAt?: Date;
  @Prop() decisionNote?: string;
}

export type LeaveRequestDocument = HydratedDocument<LeaveRequest>;
export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);
