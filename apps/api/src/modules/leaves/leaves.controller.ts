// Leaves controller.
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import {
  Role,
  decideLeaveSchema,
  requestLeaveSchema,
  type DecideLeaveInput,
  type RequestLeaveInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { LeavesService } from './leaves.service';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly svc: LeavesService) {}

  @Get('me')
  myRequests(@CurrentUser() user: JwtPayload) {
    return this.svc.myRequests(user.sub);
  }

  @Get('me/balance')
  myBalance(@CurrentUser() user: JwtPayload) {
    return this.svc.balanceFor(user.sub);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Get('pending')
  pending() {
    return this.svc.pending();
  }

  @Post()
  request(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(requestLeaveSchema)) body: RequestLeaveInput,
  ) {
    return this.svc.request(user.sub, body);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Patch(':id/decide')
  decide(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(decideLeaveSchema)) body: DecideLeaveInput,
  ) {
    return this.svc.decide(id, actor.sub, body);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.cancel(id, actor.sub);
  }
}
