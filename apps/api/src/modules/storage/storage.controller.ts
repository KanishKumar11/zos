// Storage controller — authed routes returning presigned URLs. Roles are enforced per route:
// PUT presigning requires at least MEMBER (everyone uploads avatars/files). GET presigning is
// any role (browser asks for a signed URL only after the API authorizes the resource).
import { Body, Controller, Post } from '@nestjs/common';

import { presignGetSchema, presignPutSchema, type PresignGetInput, type PresignPutInput } from '@agency/shared';

import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign-put')
  presignPut(@Body(new ZodValidationPipe(presignPutSchema)) input: PresignPutInput) {
    return this.storage.presignPut(input);
  }

  @Post('presign-get')
  presignGet(@Body(new ZodValidationPipe(presignGetSchema)) input: PresignGetInput) {
    return this.storage.presignGet(input.key);
  }
}
