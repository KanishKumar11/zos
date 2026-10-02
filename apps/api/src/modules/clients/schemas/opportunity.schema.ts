// Opportunity schema — OWNER-only CRM pipeline. A deal is for an existing client or a named
// prospect that becomes a client when the deal is won.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { CrmStage } from '@agency/shared';

@Schema({ timestamps: true, collection: 'opportunities' })
export class Opportunity {
  @Prop({ type: MS.Types.ObjectId, ref: 'Client', index: true })
  clientId?: Types.ObjectId;
  /** Company name while the deal is with someone who isn't a client yet. */
  @Prop({ type: String }) prospectName?: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true, type: Number }) valuePaise!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: String, enum: Object.values(CrmStage), default: CrmStage.LEAD, index: true })
  stage!: CrmStage;
  /** Win chance %; unset → stage default. */
  @Prop({ type: Number, min: 0, max: 100 }) probability?: number;
  @Prop({ type: Date }) expectedCloseDate?: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) ownerId?: Types.ObjectId;
  @Prop({ default: 0, type: Number }) position!: number;
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: String }) lostReason?: string;
  /** When the deal reached WON / LOST (cleared if it's reopened). */
  @Prop({ type: Date }) closedAt?: Date;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type OpportunityDocument = HydratedDocument<Opportunity>;
export const OpportunitySchema = SchemaFactory.createForClass(Opportunity);
OpportunitySchema.index({ stage: 1, position: 1 });
