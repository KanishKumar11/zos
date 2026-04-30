// @CurrentUser() — injects the JwtPayload from the authenticated request.
import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { AuthedRequest } from '../interfaces/authed-request.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | JwtPayload[keyof JwtPayload] => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    return data ? user[data] : user;
  },
);
