// ProjectFile — a file stored under projects/<id>/files/. Downloads always go through the API,
// which checks project access (and visibility for client users) before signing a URL.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'project_files' })
export class ProjectFile {
  @Prop({ type: MS.Types.ObjectId, ref: 'Project', required: true, index: true }) projectId!: Types.ObjectId;
  @Prop({ required: true }) key!: string;
  @Prop({ required: true }) name!: string;
  @Prop() contentType?: string;
  @Prop({ type: Number }) sizeBytes?: number;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: String, enum: ['INTERNAL', 'CLIENT'], default: 'INTERNAL', index: true }) visibility!: 'INTERNAL' | 'CLIENT';
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) uploadedBy?: Types.ObjectId;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ProjectFileDocument = HydratedDocument<ProjectFile>;
export const ProjectFileSchema = SchemaFactory.createForClass(ProjectFile);
ProjectFileSchema.index({ projectId: 1, createdAt: -1 });
