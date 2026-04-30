// Client schema — OWNER-only resource.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS } from 'mongoose';

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
  @Prop({ default: '' }) address!: string;
  @Prop({ type: [ClientContactSchema], default: [] }) contacts!: ClientContact[];
  @Prop({ default: '' }) notes!: string;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type ClientDocument = HydratedDocument<Client>;
export const ClientSchema = SchemaFactory.createForClass(Client);
