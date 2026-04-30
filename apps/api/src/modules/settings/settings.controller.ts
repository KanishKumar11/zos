// Settings controller — GET open to authed; PATCH OWNER+ADMIN only.
import { Body, Controller, Get, Patch } from '@nestjs/common';

import { Role, updateSettingsSchema, type UpdateSettingsInput } from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch()
  update(@Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput) {
    return this.svc.update(body);
  }
}
