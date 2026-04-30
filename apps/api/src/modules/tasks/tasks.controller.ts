// Tasks controller — covers tasks, comments, time entries.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  createCommentSchema,
  createTaskSchema,
  createTimeEntrySchema,
  listTasksQuerySchema,
  moveTaskSchema,
  updateTaskSchema,
  type CreateCommentInput,
  type CreateTaskInput,
  type CreateTimeEntryInput,
  type ListTasksQuery,
  type MoveTaskInput,
  type UpdateTaskInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  // ---------- tasks ----------
  @Get('tasks')
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(listTasksQuerySchema)) q: ListTasksQuery,
  ) {
    return this.svc.list(q, user);
  }

  @Get('tasks/:id')
  byId(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.byId(id, user);
  }

  @Post('tasks')
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.svc.create(body, user);
  }

  @Patch('tasks/:id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.svc.update(id, body, user);
  }

  @Patch('tasks/:id/move')
  move(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(moveTaskSchema)) body: MoveTaskInput,
  ) {
    return this.svc.move(id, body, user);
  }

  @Delete('tasks/:id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.remove(id, user).then(() => ({ ok: true }));
  }

  // ---------- comments ----------
  @Get('tasks/:id/comments')
  comments(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.commentsFor(id);
  }

  @Post('tasks/:id/comments')
  comment(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.svc.addComment(id, body, user);
  }

  // ---------- time ----------
  @Get('time/me')
  myTime(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.myTimeEntries(user.sub, from && to ? { from, to } : undefined);
  }

  @Post('time')
  logTime(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createTimeEntrySchema)) body: CreateTimeEntryInput,
  ) {
    return this.svc.addTimeEntry(user, body);
  }
}
