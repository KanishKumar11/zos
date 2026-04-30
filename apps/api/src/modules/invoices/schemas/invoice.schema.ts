// Invoice schema with payment subdocs.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { InvoiceStatus } from '@agency/shared';

@Schema({ _id: false })
export class InvoiceLineItem {
  @Prop({ required: true }) description!: string;
  @Prop({ required: true, type: Number }) qty!: number;
  @Prop({ required: true, type: Number }) unitPaise!: number;
}
const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

@Schema({ timestamps: true, _id: true })
export class Payment {
  @Prop({ required: true, type: Date }) paidAt!: Date;
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ default: '' }) reference!: string;
  @Prop({ default: '' }) method!: string;
}
const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  @Prop({ required: true, unique: true, index: true }) number!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Project' }) projectId?: Types.ObjectId;
  @Prop({ type: [InvoiceLineItemSchema], default: [] }) lineItems!: InvoiceLineItem[];
  @Prop({ default: 0, type: Number }) subTotalPaise!: number;
  @Prop({ default: 0, type: Number }) gstPercent!: number;
  @Prop({ default: 0, type: Number }) gstPaise!: number;
  @Prop({ default: 0, type: Number }) totalPaise!: number;
  @Prop({ default: 0, type: Number }) paidPaise!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.DRAFT, index: true })
  status!: InvoiceStatus;
  @Prop({ type: Date, index: true }) issueDate?: Date;
  @Prop({ type: Date, index: true }) dueDate?: Date;
  @Prop({ type: [PaymentSchema], default: [] }) payments!: Payment[];
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: String }) pdfKey?: string;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
