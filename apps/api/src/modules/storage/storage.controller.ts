// Storage controller — authed routes returning presigned URLs. Both routes check the key/prefix
// against the caller: OWNER may touch any area, ADMIN the staff-document area, everyone else only
// their own `users/<id>/` folder. Resource-specific downloads (payslips, invoices, user documents)
// go through their own endpoints, which authorize the resource first.
import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';

import { presignGetSchema, presignPutSchema, type PresignGetInput, type PresignPutInput } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { Role } from '@/common/types/role.type';

import { StorageService } from './storage.service';

export function canAccessStoragePath(path: string, viewer: Pick<JwtPayload, 'sub' | 'role'>): boolean {
  const clean = path.replace(/^\/+/, '');
  if (clean.split('/').some((seg) => seg === '..' || seg === '.')) return false;
  if (viewer.role === Role.OWNER) return true;
  if (viewer.role === Role.ADMIN && clean.startsWith('users/')) return true;
  return clean.startsWith(`users/${viewer.sub}/`);
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign-put')
  presignPut(
    @CurrentUser() viewer: JwtPayload,
    @Body(new ZodValidationPipe(presignPutSchema)) input: PresignPutInput,
  ) {
    if (!canAccessStoragePath(`${input.prefix}/`, viewer)) throw new ForbiddenException();
    return this.storage.presignPut(input);
  }

  @Post('presign-get')
  presignGet(
    @CurrentUser() viewer: JwtPayload,
    @Body(new ZodValidationPipe(presignGetSchema)) input: PresignGetInput,
  ) {
    if (!canAccessStoragePath(input.key, viewer)) throw new ForbiddenException();
    return this.storage.presignGet(input.key);
  }
}
