// Contracts controller — OWNER-only CRUD + retainer billing.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  type CreateContractInput,
  type GenerateClientInvoiceInput,
  type GenerateContractInvoiceInput,
  type ListContractsQuery,
  type UpdateContractInput,
  createContractSchema,
  generateClientInvoiceSchema,
  generateContractInvoiceSchema,
  listContractsQuerySchema,
  updateContractSchema,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { ContractsService } from './contracts.service';

@Roles(Role.OWNER)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  /** Each contract carries `billing` (billed / paid totals and the months already invoiced). */
  @Get()
  async list(@Query(new ZodValidationPipe(listContractsQuerySchema)) q: ListContractsQuery) {
    return this.svc.withBilling(await this.svc.list(q));
  }

  /** One invoice for several of a client's contracts — one line per contract. */
  @Post('generate-client-invoice')
  generateClientInvoice(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(generateClientInvoiceSchema)) body: GenerateClientInvoiceInput,
  ) {
    return this.svc.generateClientInvoice(body, actor.sub);
  }

  @Get(':id')
  async byId(@Param('id', ObjectIdPipe) id: string) {
    const [doc] = await this.svc.withBilling([await this.svc.byId(id)]);
    return doc;
  }

  @Post()
  create(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(createContractSchema)) body: CreateContractInput,
  ) {
    return this.svc.create(body, actor.sub);
  }

  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updateContractSchema)) body: UpdateContractInput,
  ) {
    return this.svc.update(id, body, actor.sub);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.remove(id, actor.sub).then(() => ({ ok: true }));
  }

  @Post(':id/generate-invoice')
  generateInvoice(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(generateContractInvoiceSchema)) body: GenerateContractInvoiceInput,
  ) {
    return this.svc.generateInvoice(id, body, actor.sub);
  }
}
