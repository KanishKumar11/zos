// Crypto-safe URL-safe random token generator (used for one-time invite/reset link tokens).
import { randomBytes } from 'crypto';

export const generateOpaqueToken = (bytes = 32): string =>
  randomBytes(bytes).toString('base64url');
