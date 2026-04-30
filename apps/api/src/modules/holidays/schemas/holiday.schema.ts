// Holiday — recurring or one-off org-wide holiday on a specific date.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'holidays' })
export class Holiday {
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ required: true, type: Date, index: true }) date!: Date;
  @Prop({ default: false }) optional!: boolean;
  @Prop({ trim: true }) note?: string;
}

export type HolidayDocument = HydratedDocument<Holiday>;
export const HolidaySchema = SchemaFactory.createForClass(Holiday);
HolidaySchema.index({ date: 1, name: 1 }, { unique: true });
