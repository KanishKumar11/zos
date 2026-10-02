// ProjectsModule.
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Freelancer, FreelancerSchema } from '../freelancers/schemas/freelancer.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { PayoutsModule } from '../payouts/payouts.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project, ProjectSchema } from './schemas/project.schema';

@Global()
@Module({
  imports: [
    PayoutsModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Freelancer.name, schema: FreelancerSchema },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService, MongooseModule],
})
export class ProjectsModule {}
