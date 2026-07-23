// IncomeController — OWNER-only non-client revenue CRUD.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Role } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { IncomeService } from './income.service';

@Controller('income')
@Roles(Role.OWNER)
export class IncomeController {
  constructor(private readonly svc: IncomeService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      category,
      from,
      to,
    });
  }

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.summary(from, to);
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
  update(@Param('id', ObjectIdPipe) id: string, @Body() body: UpdateIncomeDto) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id).then(() => ({ ok: true }));
  }
}
