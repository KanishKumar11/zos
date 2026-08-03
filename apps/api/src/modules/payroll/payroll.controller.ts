// Payroll controller — OWNER+ADMIN can manage runs; employees can view own payslips.
import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import {
  Role,
  createPayrollRunSchema,
  finalizePayrollRunSchema,
  payslipAdjustmentSchema,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
  type PayslipAdjustmentInput,
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

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('users/:userId/payslips')
  forUser(@Param('userId', ObjectIdPipe) userId: string) {
    return this.svc.myPayslips(userId);
  }

  // -- Adjustments (OWNER/ADMIN, only when run is DRAFT) ---------------------

  @Roles(Role.OWNER, Role.ADMIN)
  @Post('payslips/:id/adjustments')
  addAdjustment(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(payslipAdjustmentSchema)) body: PayslipAdjustmentInput,
  ) {
    return this.svc.addAdjustment(id, body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete('payslips/:id/adjustments/:idx')
  removeAdjustment(
    @Param('id', ObjectIdPipe) id: string,
    @Param('idx', ParseIntPipe) idx: number,
  ) {
    return this.svc.removeAdjustment(id, idx);
  }

  // -- PDF download (OWNER+ADMIN, or self) -----------------------------------

  @Get('payslips/:id/pdf')
  async pdf(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const slips = await this.svc.payslipsByIds([id]);
    const slip = slips[0];
    if (!slip) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payslip not found' } });
      return;
    }
    const allowed = user.role === Role.OWNER || user.role === Role.ADMIN || slip.userId.toString() === user.sub;
    if (!allowed) throw new ForbiddenException();
    const { buffer, filename } = await this.svc.payslipPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
