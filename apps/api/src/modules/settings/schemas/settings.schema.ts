// Org settings — singleton document holding workspace-wide preferences.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'settings' })
export class Settings {
  @Prop({ required: true, default: 'workspace', unique: true }) key!: string;
  @Prop({ required: true }) workspaceName!: string;
  @Prop({ required: true, default: 'INR' }) defaultCurrency!: string;
  @Prop({ default: 'Asia/Kolkata' }) timezone!: string;
  @Prop({ default: 'en-IN' }) locale!: string;
  @Prop({ type: [Number], default: [0, 6] }) weekendDays!: number[]; // 0=Sun, 6=Sat
  @Prop({ default: 18 }) annualLeavePerYear!: number;
  @Prop({ default: 12 }) sickLeavePerYear!: number;
  @Prop() logoKey?: string;
  @Prop() addressLine1?: string;
  @Prop() addressLine2?: string;
  @Prop() city?: string;
  @Prop() state?: string;
  @Prop() postalCode?: string;
  @Prop() country?: string;
  @Prop() gstin?: string;
  @Prop() pan?: string;
}

export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);
