// Expense schema — tracks business costs (tools, marketing, ops, etc.).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS } from 'mongoose';

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

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense {
  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ required: true, enum: Object.values(ExpenseCategory), default: ExpenseCategory.OTHER })
  category!: ExpenseCategory;
  @Prop({ required: true, type: Date }) date!: Date;
  @Prop() vendor?: string;
  @Prop() receiptRef?: string;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) addedBy?: MS.Types.ObjectId;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1 });
