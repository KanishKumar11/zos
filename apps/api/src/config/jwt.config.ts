// JWT secrets and TTLs for access, refresh, invite, and reset tokens.
import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  inviteSecret: string;
  inviteExpiresIn: string;
  resetSecret: string;
  resetExpiresIn: string;
}

export default registerAs<JwtConfig>('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  inviteSecret: process.env.JWT_INVITE_SECRET ?? '',
  inviteExpiresIn: process.env.JWT_INVITE_EXPIRES_IN ?? '7d',
  resetSecret: process.env.JWT_RESET_SECRET ?? '',
  resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN ?? '1h',
}));
