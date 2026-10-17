// Contract schema — retainer / monthly arrangements linked to a client.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { ContractStatus } from '@agency/shared';

@Schema({ _id: false })
export class ContractMember {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ type: Number, default: 0 }) monthlyAmountPaise!: number;
  @Prop({ default: '' }) role!: string;
  @Prop({ type: Date, default: () => new Date() }) addedAt!: Date;
}
export const ContractMemberSchema = SchemaFactory.createForClass(ContractMember);

@Schema({ _id: false })
export class ContractFreelancer {
  @Prop({ type: MS.Types.ObjectId, ref: 'Freelancer', required: true }) freelancerId!: Types.ObjectId;
  @Prop({ type: Number, default: 0 }) monthlyAmountPaise!: number;
  @Prop({ default: '' }) scope!: string;
  @Prop({ type: Date, default: () => new Date() }) addedAt!: Date;
}
export const ContractFreelancerSchema = SchemaFactory.createForClass(ContractFreelancer);

@Schema({ timestamps: true, collection: 'contracts' })
export class Contract {
  @Prop({ required: true }) name!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;
  @Prop({ default: '' }) description!: string;
  @Prop({ default: 0, type: Number }) monthlyAmountPaise!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({
    type: String,
    enum: Object.values(ContractStatus),
    default: ContractStatus.ACTIVE,
    index: true,
  })
  status!: ContractStatus;
  @Prop({ type: Date }) startDate?: Date;
  @Prop({ type: Date }) endDate?: Date;
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: Number, min: 1, max: 28 }) billingDay?: number;
  /** Default GST % for invoices generated from this contract. */
  @Prop({ type: Number, min: 0, max: 50 }) gstPercent?: number;
  /** Team members assigned to this retainer and their monthly payout. */
  @Prop({ type: [ContractMemberSchema], default: [] }) members!: ContractMember[];
  /** External contractors/freelancers assigned to this retainer and their monthly payout. */
  @Prop({ type: [ContractFreelancerSchema], default: [] }) freelancers!: ContractFreelancer[];
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ContractDocument = HydratedDocument<Contract>;
export const ContractSchema = SchemaFactory.createForClass(Contract);
