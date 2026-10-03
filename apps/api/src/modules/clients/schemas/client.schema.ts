// Client schema — OWNER-only resource.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ClientContact {
  @Prop({ required: true }) name!: string;
  @Prop() email?: string;
  @Prop() phone?: string;
  @Prop() role?: string;
}
const ClientContactSchema = SchemaFactory.createForClass(ClientContact);

@Schema({ timestamps: true, collection: 'clients' })
export class Client {
  @Prop({ required: true, index: true }) name!: string;
  @Prop({ default: '' }) gstin!: string;
  @Prop({ default: '' }) cin!: string;
  @Prop({ default: '' }) address!: string;
  @Prop({ default: '' }) pan!: string;
  /** GST place of supply. */
  @Prop({ default: '' }) state!: string;
  @Prop({ default: '' }) billingEmail!: string;
  @Prop({ default: '' }) phone!: string;
  @Prop({ default: '' }) website!: string;
  /** Who referred this client — free text, shown as a column on the clients list. */
  @Prop({ default: '', index: true }) referredBy!: string;
  /** Default due-date offset for new invoices (days after issue). */
  @Prop({ type: Number, default: 15 }) paymentTermsDays!: number;
  @Prop({ type: [ClientContactSchema], default: [] }) contacts!: ClientContact[];
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ClientDocument = HydratedDocument<Client>;
export const ClientSchema = SchemaFactory.createForClass(Client);
