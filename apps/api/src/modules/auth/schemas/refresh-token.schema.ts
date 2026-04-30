// Refresh-token record. Stored hashed; one row per active session for revocation/rotation.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true }) userId!: Types.ObjectId;
  /** Random JTI used as cookie value lookup key. */
  @Prop({ required: true, unique: true, index: true }) jti!: string;
  /** SHA-256 hash of the actual token. */
  @Prop({ required: true }) tokenHash!: string;
  @Prop({ required: true, index: { expires: 0 } }) expiresAt!: Date;
  @Prop() revokedAt?: Date;
  @Prop() userAgent?: string;
  @Prop() ipAddress?: string;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
