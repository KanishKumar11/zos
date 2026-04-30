// Compensation controller — strictly OWNER. Get profile, list history, upsert.
import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { Role, upsertCompensationSchema, type UpsertCompensationInput } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { CompensationService } from './compensation.service';

@Roles(Role.OWNER)
@Controller('compensation')
export class CompensationController {
  constructor(private readonly svc: CompensationService) {}

  @Get('users/:userId')
  byUser(@Param('userId', ObjectIdPipe) userId: string) {
    return this.svc.byUserId(userId);
  }

  @Get('users/:userId/history')
  history(@Param('userId', ObjectIdPipe) userId: string) {
    return this.svc.historyFor(userId);
  }

  @Put('users/:userId')
  upsert(
    @Param('userId', ObjectIdPipe) userId: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(upsertCompensationSchema)) body: UpsertCompensationInput,
  ) {
    return this.svc.upsert(userId, body, actor.sub);
  }
}
