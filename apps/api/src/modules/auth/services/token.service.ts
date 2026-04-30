// TokenService — central place to mint and verify the four token types.
// Each token type has its own secret + ttl loaded from config.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';

import type { JwtPayload, JwtRefreshPayload } from '@/common/interfaces/jwt-payload.interface';

export type TokenKind = 'access' | 'refresh' | 'invite' | 'reset';

interface TokenConfig {
  secret: string;
  ttl: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private readConfig(kind: TokenKind): TokenConfig {
    return {
      secret: this.config.getOrThrow<string>(`jwt.${kind}Secret`),
      ttl: this.config.getOrThrow<string>(`jwt.${kind}Expiry`),
    };
  }

  signAccess(payload: JwtPayload): string {
    const cfg = this.readConfig('access');
    return this.jwt.sign(payload, { secret: cfg.secret, expiresIn: cfg.ttl });
  }

  signRefresh(payload: JwtRefreshPayload): string {
    const cfg = this.readConfig('refresh');
    return this.jwt.sign(payload, { secret: cfg.secret, expiresIn: cfg.ttl });
  }

  signInvite(payload: { sub: string; email: string }): string {
    const cfg = this.readConfig('invite');
    return this.jwt.sign(payload, { secret: cfg.secret, expiresIn: cfg.ttl });
  }

  signReset(payload: { sub: string }): string {
    const cfg = this.readConfig('reset');
    return this.jwt.sign(payload, { secret: cfg.secret, expiresIn: cfg.ttl });
  }

  verify<T extends object>(token: string, kind: TokenKind): T {
    const cfg = this.readConfig(kind);
    return this.jwt.verify<T>(token, { secret: cfg.secret });
  }

  /** Crypto-safe random opaque string (used as JTI for refresh tokens). */
  randomId(bytes = 24): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** SHA-256 hash for storing tokens server-side without plaintext. */
  hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
