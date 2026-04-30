// Rate limiting configuration for @nestjs/throttler.
import { registerAs } from '@nestjs/config';

export interface ThrottlerConfigShape {
  ttlSeconds: number;
  limit: number;
  authLimit: number;
}

export default registerAs<ThrottlerConfigShape>('throttler', () => ({
  ttlSeconds: Number(process.env.THROTTLE_TTL_SECONDS ?? 60),
  limit: Number(process.env.THROTTLE_LIMIT ?? 100),
  authLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 20),
}));
