// Dashboard controller — owner / member endpoints.
import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';

import { Role } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('owner')
  @Roles(Role.OWNER)
  owner() {
    return this.svc.owner();
  }

  @Get('owner/charts')
  @Roles(Role.OWNER)
  ownerCharts() {
    return this.svc.ownerCharts();
  }

  @Get('owner/team-earnings')
  @Roles(Role.OWNER)
  teamEarnings(@Query('month') month?: string) {
    return this.svc.teamEarnings(month);
  }

  @Get('me')
  memberDashboard(@CurrentUser() user: JwtPayload) {
    if (!user) throw new ForbiddenException();
    return this.svc.member(user.sub);
  }
}
