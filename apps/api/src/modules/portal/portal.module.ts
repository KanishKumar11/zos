import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { CollabModule } from '../collab/collab.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { MailModule } from '../mail/mail.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PortalAdminController } from './portal-admin.controller';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    CollabModule,
    InvoicesModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  controllers: [PortalController, PortalAdminController],
  providers: [PortalService],
})
export class PortalModule {}
