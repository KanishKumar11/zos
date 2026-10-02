// SowModule. ProjectsService comes from the global ProjectsModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Sow, SowSchema } from './schemas/sow.schema';
import { SowController } from './sow.controller';
import { SowService } from './sow.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sow.name, schema: SowSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [SowController],
  providers: [SowService],
  exports: [SowService, MongooseModule],
})
export class SowModule {}
