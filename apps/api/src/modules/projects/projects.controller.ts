// Projects controller. Read open to authenticated; create/update/delete OWNER+ADMIN+LEAD.
// Every handler reachable by non-OWNERs returns through presentProject (see projects.presenter.ts).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Types } from 'mongoose';

import {
  Role,
  closeProjectSchema,
  createMilestoneSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectFreelancerInputSchema,
  projectMemberInputSchema,
  releaseMemberSchema,
  setMemberCostSchema,
  updateMilestoneSchema,
  updateProjectFreelancerSchema,
  updateProjectSchema,
  type CloseProjectInput,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectFreelancerInput,
  type ProjectMemberInput,
  type ReleaseMemberInput,
  type SetMemberCostInput,
  type UpdateMilestoneInput,
  type UpdateProjectFreelancerInput,
  type UpdateProjectInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { PayoutsService } from '../payouts/payouts.service';
import { presentProject, presentProjects } from './projects.presenter';
import { ProjectsService } from './projects.service';
import type { ProjectDocument } from './schemas/project.schema';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly svc: ProjectsService,
    private readonly payouts: PayoutsService,
  ) {}

  /** Non-owners get the work view plus what they themselves were paid (from the ledger). */
  private async present(doc: ProjectDocument, user: JwtPayload) {
    const [names, paid] = await Promise.all([
      this.svc.peopleNames(doc),
      user.role === Role.OWNER ? undefined : this.payouts.memberPaidByProject(user.sub, [doc._id as Types.ObjectId]),
    ]);
    const out = presentProject(doc, user, paid?.get(String(doc._id)));
    out.members = (out.members ?? []).map((m: { userId: unknown }) => ({ ...m, name: names.users.get(String(m.userId)) }));
    if (Array.isArray(out.freelancers)) {
      out.freelancers = out.freelancers.map((f: { freelancerId: unknown }) => ({
        ...f,
        name: names.freelancers.get(String(f.freelancerId)),
      }));
    }
    return out;
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(listProjectsQuerySchema)) q: ListProjectsQuery,
  ) {
    const page = await this.svc.list(q, user);
    const [names, paid] = await Promise.all([
      this.svc.memberNames(page.items),
      user.role === Role.OWNER
        ? undefined
        : this.payouts.memberPaidByProject(user.sub, page.items.map((p) => p._id as Types.ObjectId)),
    ]);
    const out = presentProjects(page, user, paid);
    return {
      ...out,
      items: out.items.map((p) => ({
        ...p,
        members: (p.members ?? []).map((m: { userId: unknown }) => ({ ...m, name: names.get(String(m.userId)) })),
      })),
    };
  }

  @Roles(Role.OWNER)
  @Get('health')
  projectBalances(@Query('ids') ids?: string) {
    return this.svc.projectBalances((ids ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Get('availability')
  availability() {
    return this.svc.availability();
  }

  @Get(':id')
  async byId(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.present(await this.svc.byId(id, user), user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.present(await this.svc.create(body, user), user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Patch(':id')
  async update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.present(await this.svc.update(id, body, user), user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Post(':id/members')
  async addMember(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(projectMemberInputSchema)) body: ProjectMemberInput,
  ) {
    return this.present(await this.svc.addMember(id, body, user), user);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.present(await this.svc.removeMember(id, userId), user);
  }

  /** Someone stops working on the project; their fee is settled as chosen. */
  @Roles(Role.OWNER)
  @Post(':id/members/:userId/release')
  async releaseMember(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @Body(new ZodValidationPipe(releaseMemberSchema)) body: ReleaseMemberInput,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.present(await this.svc.releaseMember(id, userId, body, user), user);
  }

  /** Close out: mark done, optionally write off the rest of the budget, settle everyone's fees. */
  @Roles(Role.OWNER)
  @Post(':id/close')
  async close(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(closeProjectSchema)) body: CloseProjectInput,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.present(await this.svc.closeProject(id, body, user), user);
  }

  @Roles(Role.OWNER)
  @Patch(':id/members/:userId/cost')
  setMemberCost(
    @Param('id', ObjectIdPipe) id: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(setMemberCostSchema)) body: SetMemberCostInput,
  ) {
    return this.svc.setMemberCost(id, userId, body.amountPaise, user);
  }

  // ── Freelancer deals (OWNER) ─────────────────────────────────────────────────────

  @Roles(Role.OWNER)
  @Post(':id/freelancers')
  addFreelancer(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(projectFreelancerInputSchema)) body: ProjectFreelancerInput,
  ) {
    return this.svc.addFreelancer(id, body, user);
  }

  @Roles(Role.OWNER)
  @Patch(':id/freelancers/:freelancerId')
  updateFreelancer(
    @Param('id', ObjectIdPipe) id: string,
    @Param('freelancerId', ObjectIdPipe) freelancerId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProjectFreelancerSchema)) body: UpdateProjectFreelancerInput,
  ) {
    return this.svc.updateFreelancer(id, freelancerId, body, user);
  }

  @Roles(Role.OWNER)
  @Delete(':id/freelancers/:freelancerId')
  removeFreelancer(
    @Param('id', ObjectIdPipe) id: string,
    @Param('freelancerId', ObjectIdPipe) freelancerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.removeFreelancer(id, freelancerId, user);
  }

  @Roles(Role.OWNER)
  @Get(':id/balance')
  projectBalance(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.projectBalance(id);
  }

  // ── Milestones (OWNER) ───────────────────────────────────────────────────────────

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
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.softDelete(id, user).then(() => ({ ok: true }));
  }
}
