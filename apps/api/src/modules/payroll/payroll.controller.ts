// Payroll controller — OWNER+ADMIN can manage runs; employees can view own payslips.
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  Role,
  createPayrollRunSchema,
  finalizePayrollRunSchema,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('runs')
  list() {
    return this.svc.list();
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('runs/:id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('runs/:id/payslips')
  payslips(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.payslipsFor(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post('runs')
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createPayrollRunSchema)) body: CreatePayrollRunInput,
  ) {
    return this.svc.create(body, user.sub);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post('runs/:id/recompute')
  recompute(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.recompute(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post('runs/:id/finalize')
  finalize(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(finalizePayrollRunSchema)) body: FinalizePayrollRunInput,
  ) {
    return this.svc.finalize(id, user.sub, body);
  }

  @Get('payslips/me')
  mine(@CurrentUser() user: JwtPayload) {
    return this.svc.myPayslips(user.sub);
  }
}
