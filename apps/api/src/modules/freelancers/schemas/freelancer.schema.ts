// Freelancer directory — external people we pay per project. No login. Their deal on each project
// lives on the project (project.freelancers[]); their payments live in the payouts ledger.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Agreement migrated from the old free-text freelancer records whose project couldn't be matched. */
@Schema({ _id: false })
export class LegacyEngagement {
  @Prop({ required: true }) legacyId!: string;
  @Prop({ required: true }) projectRef!: string;
  @Prop({ type: Number, default: 0 }) agreedPaise!: number;
}
const LegacyEngagementSchema = SchemaFactory.createForClass(LegacyEngagement);

@Schema({ timestamps: true, collection: 'freelancers' })
export class Freelancer {
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ lowercase: true, trim: true }) email?: string;
  @Prop() phone?: string;
  @Prop() skill?: string;
  @Prop() upiId?: string;
  @Prop() bankName?: string;
  @Prop() accountNumber?: string;
  @Prop() ifsc?: string;
  @Prop() pan?: string;
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: [LegacyEngagementSchema], default: [] }) legacyEngagements!: LegacyEngagement[];
  @Prop({ type: Date }) deletedAt?: Date;
}

export type FreelancerDocument = HydratedDocument<Freelancer>;
export const FreelancerSchema = SchemaFactory.createForClass(Freelancer);
FreelancerSchema.index({ name: 1 });
FreelancerSchema.index({ email: 1 }, { sparse: true });
