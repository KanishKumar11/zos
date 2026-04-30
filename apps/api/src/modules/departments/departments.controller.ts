// Departments controller — list (any authed), CUD requires OWNER or ADMIN.
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import {
  Role,
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly svc: DepartmentsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.findOrThrow(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentInput) {
    return this.svc.create(body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema)) body: UpdateDepartmentInput,
  ) {
    return this.svc.update(id, body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id);
  }
}
