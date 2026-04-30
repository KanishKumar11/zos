// Global HolidaysModule.
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { Holiday, HolidaySchema } from './schemas/holiday.schema';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Holiday.name, schema: HolidaySchema }])],
  controllers: [HolidaysController],
  providers: [HolidaysService],
  exports: [HolidaysService],
})
export class HolidaysModule {}
