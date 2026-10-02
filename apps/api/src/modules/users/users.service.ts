// UsersService — full domain ops for team management.
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import {
  AuditAction,
  EVENT_NAMES,
  Role,
  UserStatus,
  canSignIn,
  type AdminUpdateUserInput,
  type ListUsersQuery,
  type OnboardingPatchInput,
  type UpdateProfileInput,
  type UserDocumentInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit } from '@/common/utils/audit.util';
import { Paginated, paginate } from '@/common/utils/pagination.util';

import { StorageService } from '../storage/storage.service';
import { User, type UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  /** Bumps the token version and tells auth to end every open session for this user. */
  private async revokeAccess(id: string): Promise<void> {
    await this.repo.bumpTokenVersion(id);
    this.events.emit(EVENT_NAMES.user.accessRevoked, { userId: id });
  }

  findByEmail(email: string) {
    return this.repo.byEmail(email);
  }

  async findByIdOrThrow(id: string): Promise<UserDocument> {
    const u = await this.repo.byId(id);
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    return u;
  }

  create(input: Partial<User>) {
    return this.repo.create(input);
  }

  update(id: string, patch: Partial<User>) {
    return this.repo.update(id, patch);
  }

  async list(q: ListUsersQuery): Promise<Paginated<UserDocument>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const filter: Record<string, unknown> = {};
    // Portal (client) users only appear when asked for explicitly — they aren't team members.
    filter.role = q.role ?? { $ne: Role.CLIENT };
    if (q.status) filter.status = q.status;
    if (q.departmentId) filter.departmentId = new Types.ObjectId(q.departmentId);
    if (q.q) {
      const re = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }
    const [sortBy, sortDir] = (q.sort ?? 'createdAt:desc').split(':') as [string, string];
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir === 'asc' ? 1 : -1 };
    if (sortBy !== 'name') sort.name = 1;
    const [items, total] = await Promise.all([
      this.repo.list(filter, { skip: (page - 1) * pageSize, limit: pageSize, sort }),
      this.repo.count(filter),
    ]);
    return paginate(items, total, page, pageSize);
  }

  /** Self-service callers pass the narrower UpdateProfileInput — zod has already dropped employment fields. */
  async updateProfile(id: string, input: UpdateProfileInput | AdminUpdateUserInput): Promise<UserDocument> {
    const patch = input as AdminUpdateUserInput;
    const cleaned: Partial<User> = { ...(patch as Partial<User>) };
    if (patch.dateOfBirth) cleaned.dateOfBirth = new Date(patch.dateOfBirth);
    if (patch.dateOfJoining) cleaned.dateOfJoining = new Date(patch.dateOfJoining);
    if (patch.departmentId) cleaned.departmentId = new Types.ObjectId(patch.departmentId);
    if (patch.designationId) cleaned.designationId = new Types.ObjectId(patch.designationId);
    if (patch.reportingManagerId)
      cleaned.reportingManagerId = new Types.ObjectId(patch.reportingManagerId);
    const updated = await this.repo.update(id, cleaned);
    if (!updated) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    return updated;
  }

  async adminUpdate(
    id: string,
    patch: AdminUpdateUserInput,
    actor: { sub: string; role: Role },
  ): Promise<UserDocument> {
    if (id === actor.sub && patch.role && patch.role !== actor.role) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'You cannot change your own role' });
    }
    if (patch.role === Role.OWNER && actor.role !== Role.OWNER) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Only OWNER can grant OWNER role' });
    }
    if (id === actor.sub && patch.status && !canSignIn(patch.status)) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'You cannot deactivate yourself' });
    }
    if (actor.role !== Role.OWNER && (patch.role || patch.status)) {
      const target = await this.findByIdOrThrow(id);
      if (target.role === Role.OWNER) {
        throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Only the owner can change an owner account' });
      }
    }
    const before = await this.findByIdOrThrow(id);
    await this.updateProfile(id, patch);
    const finalDoc = await this.repo.update(id, {
      ...(patch.role ? { role: patch.role } : {}),
      ...(patch.status ? { status: patch.status } : {}),
    });
    if (!finalDoc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    if (patch.status && !canSignIn(patch.status)) await this.revokeAccess(id);
    this.auditAdminUpdate(before, finalDoc, patch, actor.sub);
    return finalDoc;
  }

  /** One audit entry per meaningful change: role, sign-in access, or other employment details. */
  private auditAdminUpdate(before: UserDocument, after: UserDocument, patch: AdminUpdateUserInput, actorId: string): void {
    const base = { actorId, entity: 'user', entityId: after.id as string };
    if (patch.role && patch.role !== before.role) {
      emitAudit(this.events, {
        ...base,
        action: AuditAction.MEMBER_ROLE_CHANGED,
        summary: `${after.name}: ${before.role} → ${after.role}`,
        before: { role: before.role },
        after: { role: after.role },
      });
    }
    if (patch.status && patch.status !== before.status) {
      const lostAccess = canSignIn(before.status) && !canSignIn(after.status);
      const regained = !canSignIn(before.status) && canSignIn(after.status);
      emitAudit(this.events, {
        ...base,
        action: lostAccess
          ? AuditAction.MEMBER_DEACTIVATED
          : regained
            ? AuditAction.MEMBER_REACTIVATED
            : AuditAction.MEMBER_UPDATED,
        summary: `${after.name}: status ${before.status} → ${after.status}`,
        before: { status: before.status },
        after: { status: after.status },
      });
    }
    const fields = ['name', 'phone', 'dateOfJoining', 'departmentId', 'designationId', 'reportingManagerId'] as const;
    const changed = fields.filter((f) => f in patch && String(before.get(f) ?? '') !== String(after.get(f) ?? ''));
    if (changed.length) {
      emitAudit(this.events, {
        ...base,
        action: AuditAction.MEMBER_UPDATED,
        summary: `${after.name}: changed ${changed.join(', ')}`,
        before: Object.fromEntries(changed.map((f) => [f, before.get(f) ?? null])),
        after: Object.fromEntries(changed.map((f) => [f, after.get(f) ?? null])),
      });
    }
  }

  async deactivate(id: string, actor: { sub: string; role: Role }): Promise<UserDocument> {
    if (id === actor.sub) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'You cannot deactivate yourself' });
    }
    const target = await this.findByIdOrThrow(id);
    if (target.role === Role.OWNER && actor.role !== Role.OWNER) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Only the owner can deactivate an owner account' });
    }
    const u = await this.repo.update(id, { status: UserStatus.SUSPENDED });
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    await this.revokeAccess(id);
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.MEMBER_DEACTIVATED,
      entity: 'user',
      entityId: id,
      summary: `Deactivated ${u.name}`,
      before: { status: target.status },
      after: { status: u.status },
    });
    return u;
  }

  async reactivate(id: string, actorId?: string): Promise<UserDocument> {
    const before = await this.findByIdOrThrow(id);
    const u = await this.repo.update(id, { status: UserStatus.ACTIVE });
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    emitAudit(this.events, {
      actorId,
      action: AuditAction.MEMBER_REACTIVATED,
      entity: 'user',
      entityId: id,
      summary: `Reactivated ${u.name}`,
      before: { status: before.status },
      after: { status: u.status },
    });
    return u;
  }

  async softDelete(id: string, actorId?: string): Promise<{ ok: true }> {
    const u = await this.repo.softDelete(id);
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    await this.revokeAccess(id);
    emitAudit(this.events, {
      actorId,
      action: AuditAction.MEMBER_DELETED,
      entity: 'user',
      entityId: id,
      summary: `Deleted ${u.name} (${u.email})`,
    });
    return { ok: true };
  }

  /** Audit hook for self-service bank detail changes (never logs the account number). */
  auditBankUpdate(userId: string, name: string, last4: string): void {
    emitAudit(this.events, {
      actorId: userId,
      action: AuditAction.BANK_DETAILS_UPDATED,
      entity: 'user',
      entityId: userId,
      summary: `${name} updated bank details (account ending ${last4})`,
    });
  }

  // -- Documents -----------------------------------------------------------

  async addDocument(
    userId: string,
    input: UserDocumentInput,
    actorId: string,
  ): Promise<UserDocument> {
    const u = await this.findByIdOrThrow(userId);
    u.documents.push({ ...input, uploadedBy: new Types.ObjectId(actorId) } as never);
    await u.save();
    return u;
  }

  async removeDocument(userId: string, docId: string): Promise<UserDocument> {
    const u = await this.findByIdOrThrow(userId);
    const idx = u.documents.findIndex((d: any) => d._id?.toString() === docId);
    if (idx === -1) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Document not found' });
    const removed = u.documents[idx];
    u.documents.splice(idx, 1);
    await u.save();
    if (removed?.key) {
      try {
        await this.storage.delete(removed.key);
      } catch {
        // best effort
      }
    }
    return u;
  }

  async signedDocumentUrl(userId: string, docId: string): Promise<{ url: string; expiresIn: number }> {
    const u = await this.findByIdOrThrow(userId);
    const doc = u.documents.find((d: any) => d._id?.toString() === docId);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Document not found' });
    return this.storage.presignGet(doc.key);
  }

  // -- Onboarding checklist ------------------------------------------------

  async setOnboarding(userId: string, input: OnboardingPatchInput): Promise<UserDocument> {
    const u = await this.findByIdOrThrow(userId);
    // Keep the original completion date of items that were already done; only newly ticked items get today.
    const previous = new Map<string, Date | undefined>();
    for (const it of u.onboardingChecklist) {
      if (it.completed && !previous.has(it.item)) previous.set(it.item, it.completedAt);
    }
    u.onboardingChecklist = input.items.map((i) => {
      const completed = i.completed ?? false;
      return {
        item: i.item,
        completed,
        completedAt: completed ? (previous.get(i.item) ?? new Date()) : undefined,
      };
    }) as never;
    await u.save();
    return u;
  }

  async toggleOnboardingItem(userId: string, idx: number): Promise<UserDocument> {
    const u = await this.findByIdOrThrow(userId);
    const item = u.onboardingChecklist[idx];
    if (!item) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Onboarding item not found' });
    }
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date() : undefined;
    await u.save();
    return u;
  }
}
