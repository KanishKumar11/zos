// TimeEntry schema — manual time tracking against tasks/projects.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'time_entries' })
export class TimeEntry {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId!: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Task' }) taskId?: Types.ObjectId;
  /** YYYY-MM-DD */
  @Prop({ required: true, index: true }) date!: string;
  @Prop({ required: true, type: Number }) minutes!: number;
  @Prop({ default: '' }) description!: string;
  @Prop({ default: false }) billable!: boolean;
}

export type TimeEntryDocument = HydratedDocument<TimeEntry>;
export const TimeEntrySchema = SchemaFactory.createForClass(TimeEntry);
TimeEntrySchema.index({ userId: 1, date: 1 });
