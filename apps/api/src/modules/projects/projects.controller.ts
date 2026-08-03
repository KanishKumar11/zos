// Projects controller. Read open to authenticated; create/update/delete OWNER+ADMIN+LEAD; OWNER-only fields enforced in service.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  addMemberPaymentSchema,
  createMilestoneSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectMemberInputSchema,
  setMemberCostSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  type AddMemberPaymentInput,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectMemberInput,
  type SetMemberCostInput,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SerializeResource } from '@/common/decorators/owner-only.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { ProjectsService } from './projects.service';

@Controller('projects')
@SerializeResource('project')
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
  @Patch(':id/members/:userId/cost')
  setMemberCost(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @Body(new ZodValidationPipe(setMemberCostSchema)) body: SetMemberCostInput,
  ) {
    return this.svc.setMemberCost(id, userId, body.amountPaise);
  }

  @Roles(Role.OWNER)
  @Post(':id/members/:userId/payments')
  addMemberPayment(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @Body(new ZodValidationPipe(addMemberPaymentSchema)) body: AddMemberPaymentInput,
  ) {
    return this.svc.addMemberPayment(id, userId, { amountPaise: body.amountPaise, paidAt: new Date(body.paidAt), note: body.note, forPeriod: body.forPeriod });
  }

  @Roles(Role.OWNER)
  @Delete(':id/members/:userId/payments/:paymentId')
  removeMemberPayment(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @Param('paymentId', ObjectIdPipe) paymentId: string,
  ) {
    return this.svc.removeMemberPayment(id, userId, paymentId);
  }

  @Roles(Role.OWNER)
  @Get(':id/member-costs')
  memberCosts(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.memberCosts(id);
  }

  @Roles(Role.OWNER)
  @Get(':id/balance')
  projectBalance(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.projectBalance(id);
  }

  @Roles(Role.OWNER)
  @Post(':id/milestones')
  addMilestone(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(createMilestoneSchema)) body: CreateMilestoneInput,
  ) {
    return this.svc.addMilestone(id, body);
  }

  @Roles(Role.OWNER)
  @Patch(':id/milestones/:milestoneId')
  updateMilestone(
    @Param('id', ObjectIdPipe) id: string,
    @Param('milestoneId', ObjectIdPipe) milestoneId: string,
    @Body(new ZodValidationPipe(updateMilestoneSchema)) body: UpdateMilestoneInput,
  ) {
    return this.svc.updateMilestone(id, milestoneId, body);
  }

  @Roles(Role.OWNER)
  @Delete(':id/milestones/:milestoneId')
  removeMilestone(
    @Param('id', ObjectIdPipe) id: string,
    @Param('milestoneId', ObjectIdPipe) milestoneId: string,
  ) {
    return this.svc.removeMilestone(id, milestoneId).then(() => ({ ok: true }));
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.softDelete(id).then(() => ({ ok: true }));
  }
}
