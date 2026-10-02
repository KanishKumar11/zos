// Payouts controller — OWNER-only ledger of money paid out, plus each member's own earnings.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  PayeeType,
  Role,
  createPayoutSchema,
  listPayoutsQuerySchema,
  updatePayoutSchema,
  type CreatePayoutParsed,
  type ListPayoutsQuery,
  type UpdatePayoutInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { PayoutsService } from './payouts.service';

@Controller('payouts')
@Roles(Role.OWNER)
export class PayoutsController {
  constructor(private readonly svc: PayoutsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listPayoutsQuerySchema)) q: ListPayoutsQuery) {
    return this.svc.list(q);
  }

  @Get('owed')
  owed() {
    return this.svc.owed();
  }

  @Get('import-status')
  importStatus() {
    return this.svc.importStatus();
  }

  @Post('import')
  importLegacy(@CurrentUser() actor: JwtPayload) {
    return this.svc.importLegacy(actor);
  }

  @Get('balances/project/:id')
  projectBalances(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.projectBalances(id);
  }

  @Get('balances/member/:id')
  memberBalances(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.payeeBalances(PayeeType.MEMBER, id);
  }

  @Get('balances/freelancer/:id')
  freelancerBalances(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.payeeBalances(PayeeType.FREELANCER, id);
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(createPayoutSchema)) body: CreatePayoutParsed,
  ) {
    return this.svc.create(body, actor);
  }

  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updatePayoutSchema)) body: UpdatePayoutInput,
  ) {
    return this.svc.update(id, body, actor);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.remove(id, actor);
  }
}

/** Self-service money view for staff — only ever the caller's own payouts. */
@Controller('me')
export class MeEarningsController {
  constructor(private readonly svc: PayoutsService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN)
  @Get('earnings')
  earnings(@CurrentUser() user: JwtPayload) {
    return this.svc.earnings(user.sub);
  }
}
