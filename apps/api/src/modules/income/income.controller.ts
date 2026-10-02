// IncomeController — OWNER-only non-client revenue CRUD.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Role } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

import { CreateIncomeDto, IncomeSummaryQueryDto, ListIncomeQueryDto, UpdateIncomeDto } from './dto/income.dto';
import { IncomeService } from './income.service';

@Controller('income')
@Roles(Role.OWNER)
export class IncomeController {
  constructor(private readonly svc: IncomeService) {}

  @Get()
  list(@Query() q: ListIncomeQueryDto) {
    return this.svc.list(q);
  }

  @Get('summary')
  summary(@Query() q: IncomeSummaryQueryDto) {
    return this.svc.summary(q);
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(@Body() body: CreateIncomeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(body, user.sub);
  }

  @Patch(':id')
  update(@Param('id', ObjectIdPipe) id: string, @Body() body: UpdateIncomeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.update(id, body, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(id, user.sub).then(() => ({ ok: true }));
  }
}
