// ClientsModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { CrmService } from './crm.service';
import { Client, ClientSchema } from './schemas/client.schema';
import { Opportunity, OpportunitySchema } from './schemas/opportunity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Opportunity.name, schema: OpportunitySchema },
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService, CrmService],
  exports: [ClientsService, CrmService, MongooseModule],
})
export class ClientsModule {}
