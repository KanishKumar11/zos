// Payslip — per-user, per-payroll-run line.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ _id: false })
export class PayslipBreakdown {
  @Prop({ type: Number, default: 0 }) baseAmount!: number;
  @Prop({ type: Number, default: 0 }) hra!: number;
  @Prop({ type: Number, default: 0 }) specialAllowance!: number;
  @Prop({ type: Number, default: 0 }) lopDeduction!: number;
  @Prop({ type: Number, default: 0 }) providentFundEmployee!: number;
  @Prop({ type: Number, default: 0 }) professionalTax!: number;
  @Prop({ type: Number, default: 0 }) tdsMonthly!: number;
  @Prop({ type: Number, default: 0 }) lateDeduction!: number;
  @Prop({ type: Number, default: 0 }) bonusPaise!: number;
  @Prop({ type: Number, default: 0 }) manualDeductionPaise!: number;
}
export const PayslipBreakdownSchema = SchemaFactory.createForClass(PayslipBreakdown);

@Schema({ _id: false })
export class PayslipAdjustment {
  @Prop({ required: true, enum: ['BONUS', 'DEDUCTION'] }) kind!: 'BONUS' | 'DEDUCTION';
  @Prop({ required: true }) reason!: string;
  @Prop({ required: true, type: Number }) amountPaise!: number;
}
export const PayslipAdjustmentSchema = SchemaFactory.createForClass(PayslipAdjustment);

@Schema({ timestamps: true, collection: 'payslips' })
export class Payslip {
  @Prop({ type: MS.Types.ObjectId, ref: 'PayrollRun', required: true, index: true })
  runId!: Types.ObjectId;
  /** YYYY-MM */
  @Prop({ required: true, index: true }) month!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ type: PayslipBreakdownSchema, required: true }) breakdown!: PayslipBreakdown;
  @Prop({ type: Number, required: true }) grossPaise!: number;
  @Prop({ type: Number, required: true }) deductionsPaise!: number;
  @Prop({ type: Number, required: true }) netPaise!: number;
  @Prop({ type: Number, required: true }) workingDays!: number;
  @Prop({ type: Number, required: true }) presentDays!: number;
  @Prop({ type: Number, required: true }) lopDays!: number;
  @Prop() pdfKey?: string;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: [PayslipAdjustmentSchema], default: [] }) adjustments!: PayslipAdjustment[];
}

export type PayslipDocument = HydratedDocument<Payslip>;
export const PayslipSchema = SchemaFactory.createForClass(Payslip);
PayslipSchema.index({ runId: 1, userId: 1 }, { unique: true });
