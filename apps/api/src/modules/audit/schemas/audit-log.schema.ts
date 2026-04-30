// AuditLog schema.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { AuditAction } from '@agency/shared';

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', index: true }) actorId?: Types.ObjectId;
  @Prop({ required: true, index: true }) entity!: string;
  @Prop({ index: true }) entityId?: string;
  @Prop({ type: String, enum: Object.values(AuditAction), required: true, index: true })
  action!: AuditAction;
  @Prop({ type: Object }) before?: unknown;
  @Prop({ type: Object }) after?: unknown;
  @Prop() ipAddress?: string;
  @Prop() userAgent?: string;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
