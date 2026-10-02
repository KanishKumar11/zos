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
import { PortalAccess } from '@/common/decorators/portal-access.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { encrypt, maskAccount } from '@/common/utils/crypto.util';

import { presentUser, presentUsers } from './users.presenter';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.LEAD)
  @Get()
  list(
    @CurrentUser() viewer: JwtPayload,
    @Query(new ZodValidationPipe(listUsersQuerySchema)) q: ListUsersQuery,
  ) {
    return this.svc.list(q).then((page) => presentUsers(page, viewer));
  }

  @PortalAccess()
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.svc.findByIdOrThrow(user.sub).then((u) => presentUser(u, user));
  }

  @PortalAccess()
  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.svc.updateProfile(user.sub, body).then((u) => presentUser(u, user));
  }

  @Patch('me/bank')
  async updateMyBank(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(bankDetailsSchema)) body: BankDetailsInput,
  ) {
    const enc = encrypt(body.accountNumber);
    const updated = await this.svc.update(user.sub, {
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
    if (updated) this.svc.auditBankUpdate(user.sub, updated.name, maskAccount(body.accountNumber));
    return updated ? presentUser(updated, user) : null;
  }

  /** Self, or OWNER/ADMIN/LEAD. Members and interns can't browse other people's records. */
  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string, @CurrentUser() viewer: JwtPayload) {
    const canBrowse = [Role.OWNER, Role.ADMIN, Role.LEAD].includes(viewer.role);
    if (id !== viewer.sub && !canBrowse) throw new ForbiddenException();
    return this.svc.findByIdOrThrow(id).then((u) => presentUser(u, viewer));
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(':id')
  adminUpdate(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) body: AdminUpdateUserInput,
  ) {
    return this.svc.adminUpdate(id, body, { sub: actor.sub, role: actor.role }).then((u) => presentUser(u, actor));
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/deactivate')
  deactivate(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.deactivate(id, actor).then((u) => presentUser(u, actor));
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':id/reactivate')
  reactivate(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.reactivate(id, actor.sub).then((u) => presentUser(u, actor));
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.softDelete(id, actor.sub);
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
