// User schema — central identity record. bankDetails are encrypted at rest and stripped
// from non-OWNER responses by SerializeInterceptor (see OWNER_ONLY_FIELDS).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { Role, UserStatus } from '@agency/shared';

@Schema({ _id: false })
export class BankDetails {
  @Prop({ required: true }) accountHolderName!: string;
  /** Encrypted (AES-256-GCM) ciphertext payload — never store plaintext. */
  @Prop({ required: true }) accountNumberEncrypted!: string;
  /** Last 4 digits, plaintext for UI masking. */
  @Prop({ required: true }) accountNumberLast4!: string;
  @Prop({ required: true }) ifsc!: string;
  @Prop({ required: true }) bankName!: string;
  @Prop() branch?: string;
  @Prop() upiId?: string;
}
const BankDetailsSchema = SchemaFactory.createForClass(BankDetails);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, index: true }) email!: string;
  @Prop({ required: true }) passwordHash!: string;
  @Prop({ required: true }) name!: string;
  @Prop() phone?: string;
  @Prop() avatarUrl?: string;
  @Prop({ type: String, enum: Object.values(Role), required: true, index: true }) role!: Role;
  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.INVITED, index: true })
  status!: UserStatus;

  @Prop({ type: MS.Types.ObjectId, ref: 'Department' }) departmentId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Designation' }) designationId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) reportingManagerId?: Types.ObjectId;

  @Prop() dateOfJoining?: Date;
  @Prop() dateOfBirth?: Date;

  @Prop({ type: BankDetailsSchema }) bankDetails?: BankDetails;

  @Prop({ default: 0 }) tokenVersion!: number;
  @Prop() lastLoginAt?: Date;
  @Prop({ index: true }) deletedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ deletedAt: 1, role: 1 });
