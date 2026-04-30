// [SHARED] JWT payload shape — identical on both sides of the wire.
import type { Role } from '../enums/roles.enum';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string; // refresh token id (for revocation)
  iat?: number;
  exp?: number;
}
