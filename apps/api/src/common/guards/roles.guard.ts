// Roles guard — enforces @Roles() metadata against the authenticated user's role.
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ErrorCodes } from '../constants/error-codes';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthedRequest } from '../interfaces/authed-request.interface';
import { Role } from '../types/role.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user) throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'No user' });

    if (!required.includes(user.role)) {
      throw new ForbiddenException({
        code: required.includes(Role.OWNER) && required.length === 1
          ? ErrorCodes.OWNER_ONLY
          : ErrorCodes.FORBIDDEN,
        message: 'Insufficient role',
      });
    }
    return true;
  }
}
