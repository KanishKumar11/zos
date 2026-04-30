// DepartmentsService — domain logic + duplicate-name protection.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { ErrorCodes } from '@/common/constants/error-codes';

import type { CreateDepartmentInput, UpdateDepartmentInput } from '@agency/shared';

import { DepartmentsRepository } from './departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(private readonly repo: DepartmentsRepository) {}

  list() {
    return this.repo.list();
  }

  async findOrThrow(id: string) {
    const doc = await this.repo.byId(id);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Department not found' });
    return doc;
  }

  async create(input: CreateDepartmentInput) {
    const dup = await this.repo.byName(input.name);
    if (dup) throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Department name in use' });
    return this.repo.create({
      ...input,
      headUserId: input.headUserId ? new Types.ObjectId(input.headUserId) : undefined,
    });
  }

  async update(id: string, patch: UpdateDepartmentInput) {
    if (patch.name) {
      const dup = await this.repo.byName(patch.name);
      if (dup && dup.id !== id) {
        throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Department name in use' });
      }
    }
    const doc = await this.repo.update(id, {
      ...patch,
      headUserId: patch.headUserId ? new Types.ObjectId(patch.headUserId) : undefined,
    });
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Department not found' });
    return doc;
  }

  async remove(id: string) {
    const doc = await this.repo.softDelete(id);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Department not found' });
    return { ok: true };
  }
}
