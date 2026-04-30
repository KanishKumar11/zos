// DesignationsService — depends on departments to validate FK.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import type { CreateDesignationInput, UpdateDesignationInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { DepartmentsService } from '../departments/departments.service';
import { DesignationsRepository } from './designations.repository';

@Injectable()
export class DesignationsService {
  constructor(
    private readonly repo: DesignationsRepository,
    private readonly departments: DepartmentsService,
  ) {}

  list(departmentId?: string) {
    return this.repo.list({ departmentId });
  }

  async findOrThrow(id: string) {
    const doc = await this.repo.byId(id);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Designation not found' });
    return doc;
  }

  async create(input: CreateDesignationInput) {
    await this.departments.findOrThrow(input.departmentId);
    const dup = await this.repo.byTitleInDept(input.title, input.departmentId);
    if (dup) throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Designation exists in this department' });
    return this.repo.create({
      ...input,
      departmentId: new Types.ObjectId(input.departmentId),
    });
  }

  async update(id: string, patch: UpdateDesignationInput) {
    if (patch.departmentId) await this.departments.findOrThrow(patch.departmentId);
    const { departmentId, ...rest } = patch;
    const updated = await this.repo.update(id, {
      ...rest,
      ...(departmentId ? { departmentId: new Types.ObjectId(departmentId) } : {}),
    });
    if (!updated) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Designation not found' });
    return updated;
  }

  async remove(id: string) {
    const doc = await this.repo.softDelete(id);
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Designation not found' });
    return { ok: true };
  }
}
