// Contracts controller — OWNER-only CRUD.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  type CreateContractInput,
  type ListContractsQuery,
  type UpdateContractInput,
  createContractSchema,
  listContractsQuerySchema,
  updateContractSchema,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { ContractsService } from './contracts.service';

@Roles(Role.OWNER)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listContractsQuerySchema)) q: ListContractsQuery) {
    return this.svc.list(q);
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createContractSchema)) body: CreateContractInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateContractSchema)) body: UpdateContractInput,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id).then(() => ({ ok: true }));
  }
}
