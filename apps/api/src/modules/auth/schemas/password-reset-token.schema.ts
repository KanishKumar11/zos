// Password reset token.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'password_reset_tokens' })
export class PasswordResetToken {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, unique: true, index: true }) tokenHash!: string;
  @Prop({ required: true, index: { expires: 0 } }) expiresAt!: Date;
  @Prop() usedAt?: Date;
}

export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;
export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);
