// Users controller — profile self-service + admin team management.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  adminUpdateUserSchema,
  bankDetailsSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  type AdminUpdateUserInput,
  type BankDetailsInput,
  type ListUsersQuery,
  type UpdateProfileInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { encrypt, maskAccount } from '@/common/utils/crypto.util';

import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Get()
  list(@Query(new ZodValidationPipe(listUsersQuerySchema)) q: ListUsersQuery) {
    return this.svc.list(q);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.svc.findByIdOrThrow(user.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.svc.updateProfile(user.sub, body);
  }

  @Patch('me/bank')
  async updateMyBank(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(bankDetailsSchema)) body: BankDetailsInput,
  ) {
    const enc = encrypt(body.accountNumber);
    return this.svc.update(user.sub, {
      bankDetails: {
        accountHolderName: body.accountHolderName,
        accountNumberEncrypted: enc,
        accountNumberLast4: maskAccount(body.accountNumber),
        ifsc: body.ifsc,
        bankName: body.bankName,
        branch: body.branch,
        upiId: body.upiId,
      },
    });
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.findByIdOrThrow(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  adminUpdate(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) body: AdminUpdateUserInput,
  ) {
    return this.svc.adminUpdate(id, body, { sub: actor.sub, role: actor.role });
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/deactivate')
  deactivate(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.deactivate(id);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/reactivate')
  reactivate(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.reactivate(id);
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.softDelete(id);
  }
}
