// TaskComment schema — separate collection for performance + mention indexing.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'task_comments' })
export class TaskComment {
  @Prop({ type: MS.Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;
  @Prop({ required: true }) body!: string;
  @Prop({ type: [MS.Types.ObjectId], default: [] }) mentions!: Types.ObjectId[];
}

export type TaskCommentDocument = HydratedDocument<TaskComment>;
export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);
