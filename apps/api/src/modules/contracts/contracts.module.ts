// ContractsModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { InvoicesModule } from '../invoices/invoices.module';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract, ContractSchema } from './schemas/contract.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Client.name, schema: ClientSchema },
    ]),
    InvoicesModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService, MongooseModule],
})
export class ContractsModule {}
