// PayrollRun — month-level container for one payroll cycle.
// Lifecycle: DRAFT (editable) → FINALIZED (locked, payslips sent) → PAID. OWNER can reopen a
// FINALIZED run back to DRAFT until it is marked paid.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { PayrollSkipReason, PayrollStatus } from '@agency/shared';

@Schema({ _id: false })
export class PayrollSkippedPerson {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, enum: Object.values(PayrollSkipReason), required: true }) reason!: PayrollSkipReason;
}
export const PayrollSkippedPersonSchema = SchemaFactory.createForClass(PayrollSkippedPerson);

@Schema({ timestamps: true, collection: 'payroll_runs' })
export class PayrollRun {
  /** YYYY-MM */
  @Prop({ required: true, unique: true, index: true }) month!: string;
  @Prop({ type: String, enum: Object.values(PayrollStatus), default: PayrollStatus.DRAFT, index: true })
  status!: PayrollStatus;
  @Prop({ type: Number, default: 0 }) totalNetPaise!: number;
  @Prop({ type: Number, default: 0 }) employeeCount!: number;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) createdBy?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) finalizedBy?: Types.ObjectId;
  @Prop({ type: Date }) finalizedAt?: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) paidBy?: Types.ObjectId;
  @Prop({ type: Date }) paidAt?: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) reopenedBy?: Types.ObjectId;
  @Prop({ type: Date }) reopenedAt?: Date;
  @Prop({ type: Date }) computedAt?: Date;
  /** Team members who could sign in but got no payslip, and why. */
  @Prop({ type: [PayrollSkippedPersonSchema], default: [] }) skipped!: PayrollSkippedPerson[];
  @Prop() notes?: string;
}

export type PayrollRunDocument = HydratedDocument<PayrollRun>;
export const PayrollRunSchema = SchemaFactory.createForClass(PayrollRun);
