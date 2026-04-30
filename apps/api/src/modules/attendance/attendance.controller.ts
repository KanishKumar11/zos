// Attendance controller — self check-in/out + monthly view; team view + admin marking gated.
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import {
  Role,
  adminMarkAttendanceSchema,
  checkInSchema,
  checkOutSchema,
  myAttendanceQuerySchema,
  teamAttendanceQuerySchema,
  type AdminMarkAttendanceInput,
  type MyAttendanceQuery,
  type TeamAttendanceQuery,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Post('check-in')
  checkIn(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(checkInSchema)) body: { note?: string },
  ) {
    return this.svc.checkIn(user.sub, body.note);
  }

  @Post('check-out')
  checkOut(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(checkOutSchema)) body: { note?: string },
  ) {
    return this.svc.checkOut(user.sub, body.note);
  }

  @Get('me')
  me(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(myAttendanceQuerySchema)) q: MyAttendanceQuery,
  ) {
    return this.svc.monthFor(user.sub, q.month);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Get('team')
  team(@Query(new ZodValidationPipe(teamAttendanceQuerySchema)) q: TeamAttendanceQuery) {
    return this.svc.team(q);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post('admin-mark')
  adminMark(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(adminMarkAttendanceSchema)) body: AdminMarkAttendanceInput,
  ) {
    return this.svc.adminMark(body, actor.sub);
  }
}
