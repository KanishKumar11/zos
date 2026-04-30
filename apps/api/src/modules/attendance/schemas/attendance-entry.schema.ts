// AttendanceEntry — one record per user per day. Created by check-in or admin marking.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { AttendanceStatus } from '@agency/shared';

@Schema({ timestamps: true, collection: 'attendance_entries' })
export class AttendanceEntry {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  /** ISO date YYYY-MM-DD. Stored as string for trivial uniqueness + range queries. */
  @Prop({ required: true, index: true }) date!: string;
  @Prop({ type: String, enum: Object.values(AttendanceStatus), required: true, index: true })
  status!: AttendanceStatus;
  @Prop({ type: Date }) checkInAt?: Date;
  @Prop({ type: Date }) checkOutAt?: Date;
  @Prop({ type: Number, default: 0 }) workedMinutes!: number;
  @Prop() note?: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) markedBy?: Types.ObjectId;
}

export type AttendanceEntryDocument = HydratedDocument<AttendanceEntry>;
export const AttendanceEntrySchema = SchemaFactory.createForClass(AttendanceEntry);
AttendanceEntrySchema.index({ userId: 1, date: 1 }, { unique: true });
