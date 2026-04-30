// DesignationsModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DepartmentsModule } from '../departments/departments.module';
import { DesignationsController } from './designations.controller';
import { DesignationsRepository } from './designations.repository';
import { DesignationsService } from './designations.service';
import { Designation, DesignationSchema } from './schemas/designation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Designation.name, schema: DesignationSchema }]),
    DepartmentsModule,
  ],
  controllers: [DesignationsController],
  providers: [DesignationsService, DesignationsRepository],
  exports: [DesignationsService, MongooseModule],
})
export class DesignationsModule {}
