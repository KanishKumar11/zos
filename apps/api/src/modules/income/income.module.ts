import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Income, IncomeSchema } from './schemas/income.schema';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Income.name, schema: IncomeSchema }])],
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {}
