// SOW controller — OWNER for write; brief-view available to project members.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  createProjectFromSowSchema,
  createSowSchema,
  sowBriefSchema,
  sowDocumentSchema,
  updateSowSchema,
  type CreateProjectFromSowInput,
  type CreateSowInput,
  type SowBriefInput,
  type SowDocumentInput,
  type UpdateSowInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { SowService } from './sow.service';

@Controller('sows')
export class SowController {
  constructor(private readonly svc: SowService) {}

  @Roles(Role.OWNER)
  @Get()
  list(@Query('clientId') clientId?: string, @Query('projectId') projectId?: string) {
    return this.svc.list({ clientId, projectId });
  }

  @Roles(Role.OWNER)
  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  /** Read-only brief, available to any authenticated user (typically project members). */
  @Get(':id/brief')
  brief(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.getBrief(id, user);
  }

  @Roles(Role.OWNER)
  @Post()
  create(@CurrentUser() actor: JwtPayload, @Body(new ZodValidationPipe(createSowSchema)) body: CreateSowInput) {
    return this.svc.create(body, actor.sub);
  }

  @Roles(Role.OWNER)
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updateSowSchema)) body: UpdateSowInput,
  ) {
    return this.svc.update(id, body, actor.sub);
  }

  @Roles(Role.OWNER)
  @Post(':id/brief')
  publishBrief(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(sowBriefSchema)) body: SowBriefInput,
  ) {
    return this.svc.setBrief(id, body, actor.sub);
  }

  @Roles(Role.OWNER)
  @Post(':id/document')
  setDocument(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(sowDocumentSchema)) body: SowDocumentInput,
  ) {
    return this.svc.setDocument(id, body, actor.sub);
  }

  /** Create the project this SOW describes (budget, client, milestones) and link it. */
  @Roles(Role.OWNER)
  @Post(':id/create-project')
  createProject(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(createProjectFromSowSchema)) body: CreateProjectFromSowInput,
  ) {
    return this.svc.createProject(id, body, actor);
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.remove(id, actor.sub).then(() => ({ ok: true }));
  }
}
