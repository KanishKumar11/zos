// ProjectUpdate — a status note on a project. Plain text (never HTML), so it is always safe to
// render. visibility CLIENT makes it appear in the client portal.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'project_updates' })
export class ProjectUpdate {
  @Prop({ type: MS.Types.ObjectId, ref: 'Project', required: true, index: true }) projectId!: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) authorId!: Types.ObjectId;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) body!: string;
  @Prop({ type: String, enum: ['INTERNAL', 'CLIENT'], default: 'INTERNAL', index: true }) visibility!: 'INTERNAL' | 'CLIENT';
  @Prop({ type: [{ type: MS.Types.ObjectId, ref: 'ProjectFile' }], default: [] }) fileIds!: Types.ObjectId[];
  @Prop({ type: Date }) editedAt?: Date;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ProjectUpdateDocument = HydratedDocument<ProjectUpdate>;
export const ProjectUpdateSchema = SchemaFactory.createForClass(ProjectUpdate);
ProjectUpdateSchema.index({ projectId: 1, createdAt: -1 });
