// Project schema — dual-pricing fields are OWNER-only via SerializeInterceptor (see owner-only-fields).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { ProjectMemberRole, ProjectStatus } from '@agency/shared';

@Schema({ _id: false })
export class ProjectMember {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(ProjectMemberRole), required: true })
  role!: ProjectMemberRole;
  @Prop({ type: Date, default: () => new Date() }) addedAt!: Date;
}
export const ProjectMemberSchema = SchemaFactory.createForClass(ProjectMember);

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true, index: true }) name!: string;
  @Prop({ required: true, unique: true, index: true }) code!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: String, enum: Object.values(ProjectStatus), default: ProjectStatus.ACTIVE, index: true })
  status!: ProjectStatus;

  /** Visible to all members. */
  @Prop({ type: Date }) startDate?: Date;
  @Prop({ type: Date }) endDate?: Date;
  @Prop({ type: [ProjectMemberSchema], default: [] }) members!: ProjectMember[];
  @Prop({ default: '' }) brief!: string;

  // ---- OWNER-only financials (stripped by SerializeInterceptor for non-OWNERs) ----
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', index: true }) clientId?: Types.ObjectId;
  @Prop({ type: Number, default: 0 }) clientBudgetPaise!: number;
  @Prop({ type: Number, default: 0 }) agencyMarginPaise!: number;
  @Prop({ default: 'INR' }) currency!: string;

  @Prop({ type: Date }) deletedAt?: Date;
}

export type ProjectDocument = HydratedDocument<Project>;
export const ProjectSchema = SchemaFactory.createForClass(Project);
