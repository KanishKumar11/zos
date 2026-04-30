// Holidays controller. List open to authed; CUD OWNER+ADMIN.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  createHolidaySchema,
  updateHolidaySchema,
  type CreateHolidayInput,
  type UpdateHolidayInput,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly svc: HolidaysService) {}

  @Get()
  list(@Query('year') year?: string) {
    return this.svc.list(year ? Number(year) : undefined);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(createHolidaySchema)) body: CreateHolidayInput) {
    return this.svc.create(body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateHolidaySchema)) body: UpdateHolidayInput,
  ) {
    return this.svc.update(id, body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id);
  }
}
