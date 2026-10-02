// Client deny guard — portal (CLIENT) users may only reach routes marked @PortalAccess().
// Runs after JwtAuthGuard, so `request.user` is set for every non-public route.
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ErrorCodes } from '../constants/error-codes';
import { PORTAL_ACCESS_KEY } from '../decorators/portal-access.decorator';
import type { AuthedRequest } from '../interfaces/authed-request.interface';
import { Role } from '../types/role.type';

@Injectable()
export class ClientDenyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user || user.role !== Role.CLIENT) return true;

    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(PORTAL_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;
    throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Not available in the client portal' });
  }
}
