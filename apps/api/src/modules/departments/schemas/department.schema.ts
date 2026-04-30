// Department schema — top-level org grouping (e.g. Design, Engineering).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'departments' })
export class Department {
  @Prop({ required: true, trim: true, unique: true, index: true }) name!: string;
  @Prop({ trim: true }) description?: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) headUserId?: Types.ObjectId;
  @Prop({ index: true }) deletedAt?: Date;
}

export type DepartmentDocument = HydratedDocument<Department>;
export const DepartmentSchema = SchemaFactory.createForClass(Department);
