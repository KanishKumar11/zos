// Audit controller — OWNER + ADMIN read-only.
import { Controller, Get, Query } from '@nestjs/common';

import { AuditAction, Role, paginationQuerySchema, type PaginationQuery } from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { AuditService } from './audit.service';

@Controller('audit')
@Roles(Role.OWNER, Role.ADMIN)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) pagination: PaginationQuery,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const validAction = action && (Object.values(AuditAction) as string[]).includes(action) ? (action as AuditAction) : undefined;
    return this.svc.list(pagination, {
      entity: entity || undefined,
      entityId: entityId || undefined,
      actorId: actorId || undefined,
      action: validAction,
      from: from || undefined,
      to: to || undefined,
    });
  }

  @Get('entities')
  entities() {
    return this.svc.entities();
  }
}
