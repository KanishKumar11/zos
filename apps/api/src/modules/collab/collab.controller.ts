// Project updates + files for staff. Client-portal reads live in the portal module.
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import {
  createProjectUpdateSchema,
  presignProjectFileSchema,
  registerProjectFileSchema,
  updateProjectFileSchema,
  updateProjectUpdateSchema,
  type CreateProjectUpdateInput,
  type PresignProjectFileInput,
  type RegisterProjectFileInput,
  type UpdateProjectFileInput,
  type UpdateProjectUpdateInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { CollabService } from './collab.service';

@Controller('projects/:id')
export class CollabController {
  constructor(private readonly svc: CollabService) {}

  @Get('updates')
  async updates(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.svc.projectForStaff(id, user);
    return this.svc.listUpdates(id);
  }

  @Post('updates')
  createUpdate(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createProjectUpdateSchema)) body: CreateProjectUpdateInput,
  ) {
    return this.svc.createUpdate(id, body, user);
  }

  @Patch('updates/:updateId')
  editUpdate(
    @Param('id', ObjectIdPipe) id: string,
    @Param('updateId', ObjectIdPipe) updateId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProjectUpdateSchema)) body: UpdateProjectUpdateInput,
  ) {
    return this.svc.editUpdate(id, updateId, body, user);
  }

  @Delete('updates/:updateId')
  removeUpdate(
    @Param('id', ObjectIdPipe) id: string,
    @Param('updateId', ObjectIdPipe) updateId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.removeUpdate(id, updateId, user);
  }

  @Get('files')
  async files(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.svc.projectForStaff(id, user);
    return this.svc.listFiles(id);
  }

  @Post('files/presign')
  presign(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(presignProjectFileSchema)) body: PresignProjectFileInput,
  ) {
    return this.svc.presignFile(id, body, user);
  }

  @Post('files')
  register(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(registerProjectFileSchema)) body: RegisterProjectFileInput,
  ) {
    return this.svc.registerFile(id, body, user);
  }

  @Patch('files/:fileId')
  editFile(
    @Param('id', ObjectIdPipe) id: string,
    @Param('fileId', ObjectIdPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProjectFileSchema)) body: UpdateProjectFileInput,
  ) {
    return this.svc.editFile(id, fileId, body, user);
  }

  @Delete('files/:fileId')
  removeFile(
    @Param('id', ObjectIdPipe) id: string,
    @Param('fileId', ObjectIdPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.removeFile(id, fileId, user);
  }

  @Get('files/:fileId/url')
  async fileUrl(
    @Param('id', ObjectIdPipe) id: string,
    @Param('fileId', ObjectIdPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.svc.projectForStaff(id, user);
    return this.svc.fileUrl(id, fileId);
  }
}
