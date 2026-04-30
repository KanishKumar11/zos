// Invite token — one-time link for onboarding a new user via email.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { Role } from '@agency/shared';

@Schema({ timestamps: true, collection: 'invites' })
export class Invite {
  @Prop({ required: true, lowercase: true, index: true }) email!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, enum: Object.values(Role), required: true }) role!: Role;
  @Prop({ type: MS.Types.ObjectId, ref: 'Department' }) departmentId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Designation' }) designationId?: Types.ObjectId;
  @Prop({ required: true, unique: true, index: true }) tokenHash!: string;
  @Prop({ required: true, index: { expires: 0 } }) expiresAt!: Date;
  @Prop() acceptedAt?: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) acceptedUserId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) invitedBy!: Types.ObjectId;
}

export type InviteDocument = HydratedDocument<Invite>;
export const InviteSchema = SchemaFactory.createForClass(Invite);
