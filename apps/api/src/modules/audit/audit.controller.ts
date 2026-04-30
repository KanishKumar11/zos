// Audit controller — OWNER + ADMIN read-only.
import { Controller, Get, Query } from '@nestjs/common';

import { AuditAction, Role } from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { paginationQuerySchema } from '@agency/shared';
import type { PaginationQuery } from '@agency/shared';

import { AuditService } from './audit.service';

@Controller('audit')
@Roles(Role.OWNER, Role.ADMIN)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) pagination: PaginationQuery,
    @Query('entity') entity?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: AuditAction,
  ) {
    return this.svc.list(pagination, { entity, actorId, action });
  }
}
