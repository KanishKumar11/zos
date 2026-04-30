// Designation schema — role title within a department (e.g. Senior Designer in Design).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'designations' })
export class Designation {
  @Prop({ required: true, trim: true, index: true }) title!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'Department', required: true, index: true })
  departmentId!: Types.ObjectId;
  @Prop({ trim: true }) description?: string;
  @Prop({ type: Number, min: 1, max: 10 }) seniorityLevel?: number;
  @Prop({ index: true }) deletedAt?: Date;
}

export type DesignationDocument = HydratedDocument<Designation>;
export const DesignationSchema = SchemaFactory.createForClass(Designation);
DesignationSchema.index({ title: 1, departmentId: 1 }, { unique: true });
