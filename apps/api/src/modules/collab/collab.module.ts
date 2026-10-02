import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';
import { ProjectFile, ProjectFileSchema } from './schemas/project-file.schema';
import { ProjectUpdate, ProjectUpdateSchema } from './schemas/project-update.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProjectUpdate.name, schema: ProjectUpdateSchema },
      { name: ProjectFile.name, schema: ProjectFileSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CollabController],
  providers: [CollabService],
  exports: [CollabService],
})
export class CollabModule {}
