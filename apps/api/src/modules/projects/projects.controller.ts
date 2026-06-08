// Projects controller. Read open to authenticated; create/update/delete OWNER+ADMIN+LEAD; OWNER-only fields enforced in service.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  createProjectSchema,
  listProjectsQuerySchema,
  projectMemberInputSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectMemberInput,
  type UpdateProjectInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(listProjectsQuerySchema)) q: ListProjectsQuery,
  ) {
    return this.svc.list(q, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Get('availability')
  availability() {
    return this.svc.availability();
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.byId(id, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.svc.create(body, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.svc.update(id, body, user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Post(':id/members')
  addMember(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(projectMemberInputSchema)) body: ProjectMemberInput,
  ) {
    return this.svc.addMember(id, body);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
  ) {
    return this.svc.removeMember(id, userId);
  }

  @Roles(Role.OWNER)
  @Get(':id/member-costs')
  memberCosts(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.memberCosts(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.softDelete(id).then(() => ({ ok: true }));
  }
}
