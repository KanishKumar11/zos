// FreelancerPayment schema — tracks agreed contract value + payment history per freelancer.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ _id: false })
export class FreelancerPaymentEntry {
  @Prop({ required: true, type: Date }) date!: Date;
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ default: '' }) note!: string;
}
export const FreelancerPaymentEntrySchema = SchemaFactory.createForClass(FreelancerPaymentEntry);

@Schema({ timestamps: true, collection: 'freelancer_payments' })
export class FreelancerPayment {
  @Prop({ required: true }) freelancerName!: string;
  @Prop() email?: string;
  @Prop({ required: true }) projectRef!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'Project' }) projectId?: Types.ObjectId;
  @Prop({ required: true, type: Number }) agreedTotalPaise!: number;
  @Prop({ required: true, type: Number, default: 0 }) paidPaise!: number;
  @Prop({ required: true, type: Number, default: 0 }) pendingPaise!: number;
  @Prop({ type: [FreelancerPaymentEntrySchema], default: [] }) payments!: FreelancerPaymentEntry[];
  @Prop({ enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' }) status!: string;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop() notes?: string;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type FreelancerPaymentDocument = HydratedDocument<FreelancerPayment>;
export const FreelancerPaymentSchema = SchemaFactory.createForClass(FreelancerPayment);
FreelancerPaymentSchema.index({ freelancerName: 1 });
