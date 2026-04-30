// Users controller — profile self-service + admin team management.
import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';

import {
  Role,
  adminUpdateUserSchema,
  bankDetailsSchema,
  listUsersQuerySchema,
  onboardingPatchSchema,
  updateProfileSchema,
  userDocumentInputSchema,
  type AdminUpdateUserInput,
  type BankDetailsInput,
  type ListUsersQuery,
  type OnboardingPatchInput,
  type UpdateProfileInput,
  type UserDocumentInput,
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

  // -- Member documents (OWNER+ADMIN, or self-read for own docs) -----------

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/documents')
  addDocument(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(userDocumentInputSchema)) body: UserDocumentInput,
  ) {
    return this.svc.addDocument(id, body, actor.sub);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id/documents/:docId')
  removeDocument(
    @Param('id', ObjectIdPipe) id: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.removeDocument(id, docId);
  }

  /** Self or OWNER/ADMIN can fetch a presigned URL for a doc. */
  @Get(':id/documents/:docId/url')
  docUrl(
    @Param('id', ObjectIdPipe) id: string,
    @Param('docId') docId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (id !== actor.sub && actor.role !== Role.OWNER && actor.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    return this.svc.signedDocumentUrl(id, docId);
  }

  // -- Onboarding checklist -------------------------------------------------

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id/onboarding')
  setOnboarding(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(onboardingPatchSchema)) body: OnboardingPatchInput,
  ) {
    return this.svc.setOnboarding(id, body);
  }

  /** Self may toggle their own onboarding items. */
  @Post(':id/onboarding/:idx/toggle')
  toggleOnboarding(
    @Param('id', ObjectIdPipe) id: string,
    @Param('idx', ParseIntPipe) idx: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (id !== actor.sub && actor.role !== Role.OWNER && actor.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    return this.svc.toggleOnboardingItem(id, idx);
  }
}
