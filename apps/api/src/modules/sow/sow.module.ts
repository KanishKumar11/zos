// SowModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Sow, SowSchema } from './schemas/sow.schema';
import { SowController } from './sow.controller';
import { SowService } from './sow.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Sow.name, schema: SowSchema }])],
  controllers: [SowController],
  providers: [SowService],
  exports: [SowService, MongooseModule],
})
export class SowModule {}
