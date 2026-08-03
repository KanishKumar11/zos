// Expense schema — tracks business costs (tools, marketing, ops, etc.).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

export enum ExpenseCategory {
  TOOLS = 'TOOLS',
  SOFTWARE = 'SOFTWARE',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  MARKETING = 'MARKETING',
  OPERATIONS = 'OPERATIONS',
  PAYROLL = 'PAYROLL',
  FREELANCER = 'FREELANCER',
  OTHER = 'OTHER',
}

// A team member covering part of a shared cost (e.g. a Claude subscription split
// across users), recovered by deducting it from their pay rather than cash reimbursement.
@Schema({ _id: false })
export class ExpenseContribution {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ default: '' }) note!: string;
}
export const ExpenseContributionSchema = SchemaFactory.createForClass(ExpenseContribution);

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense {
  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  /** Gross/total cost of the expense, before any team-member contributions are recovered. */
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ required: true, enum: Object.values(ExpenseCategory), default: ExpenseCategory.OTHER })
  category!: ExpenseCategory;
  @Prop({ required: true, type: Date }) date!: Date;
  @Prop() vendor?: string;
  @Prop() receiptRef?: string;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) addedBy?: MS.Types.ObjectId;
  /** Team members who covered part of amountPaise via a payroll/payout deduction. */
  @Prop({ type: [ExpenseContributionSchema], default: [] }) contributions!: ExpenseContribution[];
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ 'contributions.userId': 1 });
