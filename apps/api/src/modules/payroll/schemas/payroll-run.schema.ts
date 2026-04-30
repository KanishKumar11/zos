// PayrollRun — month-level container for one payroll cycle.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { PayrollStatus } from '@agency/shared';

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
  @Prop() notes?: string;
}

export type PayrollRunDocument = HydratedDocument<PayrollRun>;
export const PayrollRunSchema = SchemaFactory.createForClass(PayrollRun);
