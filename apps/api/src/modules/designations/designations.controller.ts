// Designations controller. CUD requires OWNER/ADMIN; list/get is open to authed users.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  createDesignationSchema,
  updateDesignationSchema,
  type CreateDesignationInput,
  type UpdateDesignationInput,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { DesignationsService } from './designations.service';

@Controller('designations')
export class DesignationsController {
  constructor(private readonly svc: DesignationsService) {}

  @Get()
  list(@Query('departmentId') departmentId?: string) {
    return this.svc.list(departmentId);
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.findOrThrow(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(createDesignationSchema)) body: CreateDesignationInput) {
    return this.svc.create(body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateDesignationSchema)) body: UpdateDesignationInput,
  ) {
    return this.svc.update(id, body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id);
  }
}
