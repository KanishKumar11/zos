// Freelancers controller — OWNER-only directory.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  freelancerInputSchema,
  linkLegacyEngagementSchema,
  updateFreelancerSchema,
  type FreelancerInput,
  type LinkLegacyEngagementInput,
  type UpdateFreelancerInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { FreelancersService } from './freelancers.service';

@Controller('freelancers')
@Roles(Role.OWNER)
export class FreelancersController {
  constructor(private readonly svc: FreelancersService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.svc.list(q);
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(@CurrentUser() actor: JwtPayload, @Body(new ZodValidationPipe(freelancerInputSchema)) body: FreelancerInput) {
    return this.svc.create(body, actor.sub);
  }

  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updateFreelancerSchema)) body: UpdateFreelancerInput,
  ) {
    return this.svc.update(id, body, actor.sub);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.remove(id, actor.sub);
  }

  @Post(':id/link-legacy')
  linkLegacy(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(linkLegacyEngagementSchema)) body: LinkLegacyEngagementInput,
  ) {
    return this.svc.linkLegacy(id, body.legacyId, body.projectId, actor.sub);
  }
}
