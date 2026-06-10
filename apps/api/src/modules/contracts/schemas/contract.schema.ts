// Contract schema — retainer / monthly arrangements linked to a client.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { ContractStatus } from '@agency/shared';

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
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ContractDocument = HydratedDocument<Contract>;
export const ContractSchema = SchemaFactory.createForClass(Contract);
