// AnnouncementsModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Announcement.name, schema: AnnouncementSchema }]),
    UsersModule,
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
