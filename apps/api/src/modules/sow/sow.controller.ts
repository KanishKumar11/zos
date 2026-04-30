// SOW controller — OWNER only.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  createSowSchema,
  updateSowSchema,
  type CreateSowInput,
  type UpdateSowInput,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { SowService } from './sow.service';

@Controller('sows')
@Roles(Role.OWNER)
export class SowController {
  constructor(private readonly svc: SowService) {}

  @Get()
  list(@Query('clientId') clientId?: string, @Query('projectId') projectId?: string) {
    return this.svc.list({ clientId, projectId });
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createSowSchema)) body: CreateSowInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateSowSchema)) body: UpdateSowInput,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id).then(() => ({ ok: true }));
  }
}
