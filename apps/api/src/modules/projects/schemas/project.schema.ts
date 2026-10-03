// Project schema — dual-pricing fields are OWNER-only via SerializeInterceptor (see owner-only-fields).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { ProjectMemberRole, ProjectStatus } from '@agency/shared';

@Schema({ _id: true })
export class MemberPayment {
  @Prop({ type: Date, required: true }) paidAt!: Date;
  @Prop({ type: Number, required: true }) amountPaise!: number;
  @Prop({ type: String, default: '' }) note!: string;
  @Prop({ type: String }) forPeriod?: string;
}
export const MemberPaymentSchema = SchemaFactory.createForClass(MemberPayment);

@Schema({ _id: true })
export class ProjectMilestone {
  @Prop({ required: true }) name!: string;
  @Prop({ type: Number, required: true, default: 0 }) amountPaise!: number;
  @Prop({ type: Date }) dueDate?: Date;
  @Prop({ type: String, enum: ['PENDING', 'INVOICED', 'COLLECTED'], default: 'PENDING' }) status!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'Invoice' }) invoiceId?: Types.ObjectId;
  @Prop({ type: String, default: '' }) note!: string;
}
export const ProjectMilestoneSchema = SchemaFactory.createForClass(ProjectMilestone);

@Schema({ _id: false })
export class ProjectMember {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(ProjectMemberRole), required: true })
  role!: ProjectMemberRole;
  @Prop({ type: Date, default: () => new Date() }) addedAt!: Date;
  /** Agreed fee for this member on this project (OWNER-only). */
  @Prop({ type: Number, default: 0 }) amountPaise!: number;
  /** Legacy embedded payments — moved into the payouts ledger by the import. Not written any more. */
  @Prop({ type: [MemberPaymentSchema], default: [] }) payments!: MemberPayment[];
  /** Set when they stop working on the project. They stay listed so their history and pay add up. */
  @Prop({ type: Date }) leftAt?: Date;
}
export const ProjectMemberSchema = SchemaFactory.createForClass(ProjectMember);

/** A freelancer's deal on this project. Payments against it live in the payouts ledger. */
@Schema({ _id: false })
export class ProjectFreelancer {
  @Prop({ type: MS.Types.ObjectId, ref: 'Freelancer', required: true }) freelancerId!: Types.ObjectId;
  @Prop({ type: Number, default: 0 }) agreedPaise!: number;
  @Prop({ default: '' }) scope!: string;
  @Prop({ type: Date, default: () => new Date() }) addedAt!: Date;
}
export const ProjectFreelancerSchema = SchemaFactory.createForClass(ProjectFreelancer);

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
  @Prop({ type: [ProjectMilestoneSchema], default: [] }) milestones!: ProjectMilestone[];
  @Prop({ default: '' }) brief!: string;
  /** OWNER-only: freelancers engaged on this project and their agreed fee. */
  @Prop({ type: [ProjectFreelancerSchema], default: [] }) freelancers!: ProjectFreelancer[];
  /** Shown in the client portal unless switched off. */
  @Prop({ default: true }) portalVisible!: boolean;
  /** When the project was closed out (OWNER flow). */
  @Prop({ type: Date }) closedAt?: Date;
  /** OWNER-only: set when the rest of the client budget was written off at close-out. */
  @Prop({ type: Date }) writtenOffAt?: Date;
  @Prop({ default: '' }) closeNote!: string;

  // ---- OWNER-only financials (stripped by SerializeInterceptor for non-OWNERs) ----
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', index: true }) clientId?: Types.ObjectId;
  @Prop({ type: Number, default: 0 }) clientBudgetPaise!: number;
  @Prop({ type: Number, default: 0 }) agencyMarginPaise!: number;
  @Prop({ default: 'INR' }) currency!: string;

  @Prop({ type: Date }) deletedAt?: Date;
}

export type ProjectDocument = HydratedDocument<Project>;
export const ProjectSchema = SchemaFactory.createForClass(Project);
