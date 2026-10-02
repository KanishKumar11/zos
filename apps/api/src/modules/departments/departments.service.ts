// DepartmentsService — domain logic + duplicate-name protection + member counts.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { Role, type CreateDepartmentInput, type UpdateDepartmentInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { UsersRepository } from '../users/users.repository';
import { DepartmentsRepository } from './departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly repo: DepartmentsRepository,
    private readonly users: UsersRepository,
  ) {}

  /** Departments with how many (non-deleted) team members are in each. */
  async list() {
    const [docs, members] = await Promise.all([
      this.repo.list(),
      this.users.list({ role: { $ne: Role.CLIENT }, departmentId: { $exists: true, $ne: null } }, { limit: 10000 }),
    ]);
    const counts = new Map<string, number>();
    for (const m of members) {
      const key = m.departmentId?.toString();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return docs.map((d) => ({ ...d.toJSON(), memberCount: counts.get(d.id as string) ?? 0 }));
  }

  async findOrThrow(id: string) {
    const doc = await this.repo.byId(id);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Department not found' });
    return doc;
  }

  async create(input: CreateDepartmentInput) {
    const dup = await this.repo.byName(input.name.trim());
    if (dup) throw new ConflictException({ code: ErrorCodes.CONFLICT, message: `There is already a department called “${input.name.trim()}”` });
    return this.repo.create({
      ...input,
      name: input.name.trim(),
      headUserId: input.headUserId ? new Types.ObjectId(input.headUserId) : undefined,
    });
  }

  async update(id: string, patch: UpdateDepartmentInput) {
    if (patch.name) {
      const dup = await this.repo.byName(patch.name.trim());
      if (dup && dup.id !== id) {
        throw new ConflictException({ code: ErrorCodes.CONFLICT, message: `There is already a department called “${patch.name.trim()}”` });
      }
    }
    const { headUserId, ...rest } = patch;
    const doc = await this.repo.update(id, {
      ...rest,
      ...(rest.name ? { name: rest.name.trim() } : {}),
      ...(headUserId ? { headUserId: new Types.ObjectId(headUserId) } : {}),
    });
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Department not found' });
    return doc;
  }

  async remove(id: string) {
    const doc = await this.findOrThrow(id);
    const members = await this.users.count({ departmentId: new Types.ObjectId(id) });
    if (members > 0) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `${doc.name} still has ${members} member${members === 1 ? '' : 's'}. Move them to another department first.`,
        details: { memberCount: members },
      });
    }
    await this.repo.softDelete(id);
    return { ok: true };
  }
}
