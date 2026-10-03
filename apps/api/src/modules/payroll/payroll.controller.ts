// Payroll controller — OWNER only (pay is owner-and-self only); employees can view their own released payslips.
import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import {
  Role,
  createPayrollRunSchema,
  finalizePayrollRunSchema,
  markPayrollPaidSchema,
  payslipAdjustmentSchema,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
  type MarkPayrollPaidInput,
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

  @Roles(Role.OWNER)
  @Get('runs')
  list() {
    return this.svc.list();
  }

  @Roles(Role.OWNER)
  @Get('runs/:id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Roles(Role.OWNER)
  @Get('runs/:id/payslips')
  payslips(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.payslipsFor(id);
  }

  @Roles(Role.OWNER)
  @Post('runs')
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createPayrollRunSchema)) body: CreatePayrollRunInput,
  ) {
    return this.svc.create(body, user.sub);
  }

  @Roles(Role.OWNER)
  @Post('runs/:id/recompute')
  recompute(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.recompute(id);
  }

  @Roles(Role.OWNER)
  @Post('runs/:id/finalize')
  finalize(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(finalizePayrollRunSchema)) body: FinalizePayrollRunInput,
  ) {
    return this.svc.finalize(id, user.sub, body);
  }

  @Roles(Role.OWNER)
  @Post('runs/:id/mark-paid')
  markPaid(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(markPayrollPaidSchema)) body: MarkPayrollPaidInput,
  ) {
    return this.svc.markPaid(id, user.sub, body);
  }

  /** OWNER only: unlock a finalized (not yet paid) run. */
  @Roles(Role.OWNER)
  @Post('runs/:id/reopen')
  reopen(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.reopen(id, { sub: user.sub, role: user.role });
  }

  /** Bank-transfer sheet for a run — OWNER only, because bank details are owner-only. */
  @Roles(Role.OWNER)
  @Get('runs/:id/bank-export')
  bankExport(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.bankExport(id);
  }

  @Get('payslips/me')
  mine(@CurrentUser() user: JwtPayload) {
    return this.svc.myPayslips(user.sub, { releasedOnly: true });
  }

  @Roles(Role.OWNER)
  @Get('users/:userId/payslips')
  forUser(@Param('userId', ObjectIdPipe) userId: string) {
    return this.svc.myPayslips(userId);
  }

  // -- Adjustments (OWNER, only when run is DRAFT) ---------------------------

  @Roles(Role.OWNER)
  @Post('payslips/:id/adjustments')
  addAdjustment(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(payslipAdjustmentSchema)) body: PayslipAdjustmentInput,
  ) {
    return this.svc.addAdjustment(id, body);
  }

  @Roles(Role.OWNER)
  @Delete('payslips/:id/adjustments/:idx')
  removeAdjustment(
    @Param('id', ObjectIdPipe) id: string,
    @Param('idx', ParseIntPipe) idx: number,
  ) {
    return this.svc.removeAdjustment(id, idx);
  }

  // -- PDF download (OWNER, or the person themselves once released) ----------

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
    const allowed = user.role === Role.OWNER || slip.userId.toString() === user.sub;
    if (!allowed) throw new ForbiddenException();
    // People only get their own payslip once the run is finalized (drafts can still change).
    if (user.role !== Role.OWNER && !(await this.svc.isReleased(slip.runId.toString()))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This payslip is not final yet' });
    }
    const { buffer, filename } = await this.svc.payslipPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
