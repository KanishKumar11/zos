// Owner-resource guard — allows a route accessing /:userId only for that user themself,
// or for OWNER/ADMIN. Use alongside @UseGuards(JwtAuthGuard, OwnerResourceGuard).
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { ErrorCodes } from '../constants/error-codes';
import type { AuthedRequest } from '../interfaces/authed-request.interface';
import { Role } from '../types/role.type';

@Injectable()
export class OwnerResourceGuard implements CanActivate {
  /** Param name on the route that holds the user id (default: 'userId'). */
  protected readonly paramName: string = 'userId';
  /** Roles that may bypass the self check. */
  protected readonly elevatedRoles: readonly Role[] = [Role.OWNER, Role.ADMIN];

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const targetId = req.params?.[this.paramName] ?? req.params?.id;
    if (!targetId) return true;
    if (this.elevatedRoles.includes(req.user.role)) return true;
    if (req.user.sub === targetId) return true;
    throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Not your resource' });
  }
}
