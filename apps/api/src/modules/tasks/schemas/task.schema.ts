// Task schema — Kanban-ready with float positions for ordering.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { TaskPriority, TaskStatus } from '@agency/shared';

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ type: MS.Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId!: Types.ObjectId;
  @Prop({ required: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: String, enum: Object.values(TaskStatus), default: TaskStatus.TODO, index: true })
  status!: TaskStatus;
  @Prop({ type: String, enum: Object.values(TaskPriority), default: TaskPriority.MEDIUM })
  priority!: TaskPriority;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', index: true }) assigneeId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) createdBy!: Types.ObjectId;
  @Prop({ type: Date }) dueDate?: Date;
  /** Float position used for kanban ordering. */
  @Prop({ type: Number, default: 0 }) position!: number;
  @Prop({ type: MS.Types.ObjectId, ref: 'Task' }) parentId?: Types.ObjectId;
  @Prop({ type: [String], default: [] }) labels!: string[];
  @Prop({ type: [String], default: [] }) attachmentKeys!: string[];
  @Prop({ type: Date }) completedAt?: Date;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ projectId: 1, status: 1, position: 1 });
