// @Roles(Role.OWNER, Role.ADMIN) — required by RolesGuard for route access.
import { SetMetadata } from '@nestjs/common';

import { Role } from '../types/role.type';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
