// Clients + CRM controller (OWNER only).
import { Types } from 'mongoose';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  CrmStage,
  Role,
  createClientSchema,
  createOpportunitySchema,
  moveOpportunitySchema,
  updateClientSchema,
  updateOpportunitySchema,
  type CreateClientInput,
  type CreateOpportunityInput,
  type MoveOpportunityInput,
  type UpdateClientInput,
  type UpdateOpportunityInput,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { ClientsService } from './clients.service';
import { CrmService } from './crm.service';

@Controller()
@Roles(Role.OWNER)
export class ClientsController {
  constructor(private readonly clients: ClientsService, private readonly crm: CrmService) {}

  // -- clients --
  @Get('clients')
  async list(@Query('search') search?: string, @Query('withStats') withStats?: string) {
    const clients = await this.clients.list(search);
    if (withStats !== '1') return clients;
    const stats = await this.clients.stats(clients.map((c) => c._id as Types.ObjectId));
    return clients.map((c) => ({ ...(c.toJSON() as Record<string, unknown>), stats: stats[c.id] ?? null }));
  }
  @Get('clients/:id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.clients.byId(id);
  }
  @Get('clients/:id/stats')
  async stats(@Param('id', ObjectIdPipe) id: string) {
    await this.clients.byId(id);
    const all = await this.clients.stats([new Types.ObjectId(id)]);
    return all[id] ?? null;
  }
  @Post('clients')
  create(@CurrentUser() actor: JwtPayload, @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput) {
    return this.clients.create(body, actor.sub);
  }
  @Patch('clients/:id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return this.clients.update(id, body, actor.sub);
  }
  @Delete('clients/:id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.clients.remove(id, actor.sub).then(() => ({ ok: true }));
  }

  // -- opportunities (CRM pipeline) --
  @Get('crm/opportunities')
  opportunities(@Query('stage') stage?: CrmStage) {
    return this.crm.list(stage);
  }
  @Get('crm/opportunities/:id')
  opportunity(@Param('id', ObjectIdPipe) id: string) {
    return this.crm.byId(id);
  }
  @Post('crm/opportunities')
  createOpp(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(createOpportunitySchema)) body: CreateOpportunityInput,
  ) {
    return this.crm.create(body, actor.sub);
  }
  @Patch('crm/opportunities/:id')
  updateOpp(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updateOpportunitySchema)) body: UpdateOpportunityInput,
  ) {
    return this.crm.update(id, body, actor.sub);
  }
  @Patch('crm/opportunities/:id/move')
  moveOpp(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(moveOpportunitySchema)) body: MoveOpportunityInput,
  ) {
    return this.crm.move(id, body, actor.sub);
  }
  /** Won deal with a prospect → add them as a client (or link the existing one with that name). */
  @Post('crm/opportunities/:id/convert-client')
  convertOpp(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.crm.convertToClient(id, actor.sub);
  }
  @Delete('crm/opportunities/:id')
  removeOpp(@Param('id', ObjectIdPipe) id: string) {
    return this.crm.remove(id).then(() => ({ ok: true }));
  }
}
