// Clients + CRM controller (OWNER only).
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
  list(@Query('search') search?: string) {
    return this.clients.list(search);
  }
  @Get('clients/:id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.clients.byId(id);
  }
  @Post('clients')
  create(@Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput) {
    return this.clients.create(body);
  }
  @Patch('clients/:id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return this.clients.update(id, body);
  }
  @Delete('clients/:id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.clients.remove(id).then(() => ({ ok: true }));
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
    @Body(new ZodValidationPipe(createOpportunitySchema)) body: CreateOpportunityInput,
  ) {
    return this.crm.create(body);
  }
  @Patch('crm/opportunities/:id')
  updateOpp(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateOpportunitySchema)) body: UpdateOpportunityInput,
  ) {
    return this.crm.update(id, body);
  }
  @Patch('crm/opportunities/:id/move')
  moveOpp(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(moveOpportunitySchema)) body: MoveOpportunityInput,
  ) {
    return this.crm.move(id, body);
  }
  @Delete('crm/opportunities/:id')
  removeOpp(@Param('id', ObjectIdPipe) id: string) {
    return this.crm.remove(id).then(() => ({ ok: true }));
  }
}
