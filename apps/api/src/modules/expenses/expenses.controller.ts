// ExpensesController — OWNER-only expense CRUD.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Role } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

import { CreateExpenseDto, ExpenseSummaryQueryDto, ListExpensesQueryDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@Roles(Role.OWNER)
export class ExpensesController {
  constructor(private readonly svc: ExpensesService) {}

  @Get()
  list(@Query() q: ListExpensesQueryDto) {
    return this.svc.list(q);
  }

  @Get('summary')
  summary(@Query() q: ExpenseSummaryQueryDto) {
    return this.svc.summary(q);
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(@Body() body: CreateExpenseDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(body, user.sub);
  }

  /** Copy a monthly / yearly expense into the next period. */
  @Post(':id/repeat')
  repeat(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.repeat(id, user.sub);
  }

  @Patch(':id')
  update(@Param('id', ObjectIdPipe) id: string, @Body() body: UpdateExpenseDto, @CurrentUser() user: JwtPayload) {
    return this.svc.update(id, body, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(id, user.sub).then(() => ({ ok: true }));
  }
}
