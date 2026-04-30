// UsersService — full domain ops for team management.
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import {
  Role,
  UserStatus,
  type AdminUpdateUserInput,
  type ListUsersQuery,
  type OnboardingPatchInput,
  type UpdateProfileInput,
  type UserDocumentInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { Paginated, paginate } from '@/common/utils/pagination.util';

import { StorageService } from '../storage/storage.service';
import { User, type UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly storage: StorageService,
  ) {}

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
    if (q.role) filter.role = q.role;
    if (q.status) filter.status = q.status;
    if (q.departmentId) filter.departmentId = new Types.ObjectId(q.departmentId);
    if (q.q) {
      const re = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }
    const [items, total] = await Promise.all([
      this.repo.list(filter, { skip: (page - 1) * pageSize, limit: pageSize }),
      this.repo.count(filter),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async updateProfile(id: string, patch: UpdateProfileInput): Promise<UserDocument> {
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
    await this.updateProfile(id, patch as UpdateProfileInput);
    const finalDoc = await this.repo.update(id, {
      ...(patch.role ? { role: patch.role } : {}),
      ...(patch.status ? { status: patch.status } : {}),
    });
    if (!finalDoc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    return finalDoc;
  }

  async deactivate(id: string): Promise<UserDocument> {
    const u = await this.repo.update(id, { status: UserStatus.SUSPENDED });
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    return u;
  }

  async reactivate(id: string): Promise<UserDocument> {
    const u = await this.repo.update(id, { status: UserStatus.ACTIVE });
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    return u;
  }

  async softDelete(id: string): Promise<{ ok: true }> {
    const u = await this.repo.softDelete(id);
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    return { ok: true };
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
    u.onboardingChecklist = input.items.map((i) => ({
      item: i.item,
      completed: i.completed ?? false,
      completedAt: i.completed ? new Date() : undefined,
    })) as never;
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
