// InvoicesModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ClientsModule } from '../clients/clients.module';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Project.name, schema: ProjectSchema },
      // Registered directly (not via ContractsModule, which imports this module) to show contract names.
      { name: Contract.name, schema: ContractSchema },
    ]),
    ClientsModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService, MongooseModule],
})
export class InvoicesModule {}
