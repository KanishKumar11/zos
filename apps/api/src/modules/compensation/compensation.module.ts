// CompensationModule — exports service for payroll computation.
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';
import {
  CompensationHistory,
  CompensationHistorySchema,
} from './schemas/compensation-history.schema';
import {
  CompensationProfile,
  CompensationProfileSchema,
} from './schemas/compensation-profile.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompensationProfile.name, schema: CompensationProfileSchema },
      { name: CompensationHistory.name, schema: CompensationHistorySchema },
    ]),
  ],
  controllers: [CompensationController],
  providers: [CompensationService],
  exports: [CompensationService],
})
export class CompensationModule {}
