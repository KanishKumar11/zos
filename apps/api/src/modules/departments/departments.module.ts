// DepartmentsModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '../users/users.module';
import { DepartmentsController } from './departments.controller';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { Department, DepartmentSchema } from './schemas/department.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Department.name, schema: DepartmentSchema }]), UsersModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsService, MongooseModule],
})
export class DepartmentsModule {}
