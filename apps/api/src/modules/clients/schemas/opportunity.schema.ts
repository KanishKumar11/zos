// Opportunity schema — OWNER-only CRM pipeline.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { CrmStage } from '@agency/shared';

@Schema({ timestamps: true, collection: 'opportunities' })
export class Opportunity {
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true, type: Number }) valuePaise!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: String, enum: Object.values(CrmStage), default: CrmStage.LEAD, index: true })
  stage!: CrmStage;
  @Prop({ type: Date }) expectedCloseDate?: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) ownerId?: Types.ObjectId;
  @Prop({ default: 0, type: Number }) position!: number;
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type OpportunityDocument = HydratedDocument<Opportunity>;
export const OpportunitySchema = SchemaFactory.createForClass(Opportunity);
OpportunitySchema.index({ stage: 1, position: 1 });
