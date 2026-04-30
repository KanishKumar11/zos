// AuthService — login, logout, refresh rotation, invite issuance/acceptance, password reset.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Role, UserStatus } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { comparePassword, hashPassword } from '@/common/utils/password.util';

import type {
  AcceptInviteInput,
  InviteUserInput,
  LoginInput,
  PerformPasswordResetInput,
  RequestPasswordResetInput,
} from '../dto/auth.dto';
import { Invite, type InviteDocument } from '../schemas/invite.schema';
import {
  PasswordResetToken,
  type PasswordResetTokenDocument,
} from '../schemas/password-reset-token.schema';
import { RefreshToken, type RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';

const REFRESH_TTL_DAYS = 30;
const INVITE_TTL_HOURS = 72;
const RESET_TTL_HOURS = 2;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    @InjectModel(RefreshToken.name) private readonly refreshModel: Model<RefreshTokenDocument>,
    @InjectModel(Invite.name) private readonly inviteModel: Model<InviteDocument>,
    @InjectModel(PasswordResetToken.name)
    private readonly resetModel: Model<PasswordResetTokenDocument>,
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────────────
  async login(input: LoginInput, meta: { ip?: string; ua?: string }): Promise<IssuedTokens> {
    const user = await this.users.findByEmail(input.email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }
    const ok = await comparePassword(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }
    user.lastLoginAt = new Date();
    await user.save();
    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  // ── Token issuance ───────────────────────────────────────────────────────────────
  private async issueTokens(
    userId: string,
    email: string,
    role: Role,
    meta: { ip?: string; ua?: string },
  ): Promise<IssuedTokens> {
    const jti = this.tokens.randomId();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000);
    const accessToken = this.tokens.signAccess({ sub: userId, email, role });
    const refreshToken = this.tokens.signRefresh({ sub: userId, jti });
    await this.refreshModel.create({
      userId,
      jti,
      tokenHash: this.tokens.hash(refreshToken),
      expiresAt: refreshExpiresAt,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    });
    return { accessToken, refreshToken, refreshJti: jti, refreshExpiresAt };
  }

  // ── Refresh rotation ─────────────────────────────────────────────────────────────
  async refresh(refreshToken: string, meta: { ip?: string; ua?: string }): Promise<IssuedTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = this.tokens.verify<{ sub: string; jti: string }>(refreshToken, 'refresh');
    } catch {
      throw new UnauthorizedException({ code: ErrorCodes.TOKEN_EXPIRED, message: 'Refresh expired' });
    }
    const stored = await this.refreshModel.findOne({ jti: payload.jti });
    if (!stored || stored.revokedAt || stored.tokenHash !== this.tokens.hash(refreshToken)) {
      // Possible reuse — revoke all sessions for this user.
      await this.refreshModel.updateMany({ userId: payload.sub, revokedAt: { $exists: false } }, {
        $set: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ code: ErrorCodes.UNAUTHENTICATED, message: 'Refresh reused' });
    }
    stored.revokedAt = new Date();
    await stored.save();

    const user = await this.users.findByIdOrThrow(payload.sub);
    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  // ── Logout ───────────────────────────────────────────────────────────────────────
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = this.tokens.verify<{ sub: string; jti: string }>(refreshToken, 'refresh');
      await this.refreshModel.updateOne({ jti: payload.jti }, { $set: { revokedAt: new Date() } });
    } catch {
      // ignore expired tokens during logout
    }
  }

  // ── Invites ──────────────────────────────────────────────────────────────────────
  async createInvite(input: InviteUserInput, invitedBy: string): Promise<{ token: string; expiresAt: Date }> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new ConflictException({ code: ErrorCodes.EMAIL_TAKEN, message: 'Email already in use' });
    }
    const token = this.tokens.signInvite({ sub: input.email, email: input.email });
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
    await this.inviteModel.create({
      email: input.email,
      name: input.name,
      role: input.role,
      departmentId: input.departmentId,
      designationId: input.designationId,
      tokenHash: this.tokens.hash(token),
      expiresAt,
      invitedBy,
    });
    return { token, expiresAt };
  }

  async acceptInvite(input: AcceptInviteInput): Promise<{ userId: string }> {
    const tokenHash = this.tokens.hash(input.token);
    const invite = await this.inviteModel.findOne({ tokenHash });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException({ code: ErrorCodes.INVITE_INVALID, message: 'Invalid invite' });
    }
    try {
      this.tokens.verify(input.token, 'invite');
    } catch {
      throw new BadRequestException({ code: ErrorCodes.INVITE_INVALID, message: 'Invite expired' });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email: invite.email,
      name: input.name ?? invite.name,
      role: invite.role,
      departmentId: invite.departmentId,
      designationId: invite.designationId,
      phone: input.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
    });
    invite.acceptedAt = new Date();
    invite.acceptedUserId = user._id;
    await invite.save();
    return { userId: user.id };
  }

  // ── Password reset ───────────────────────────────────────────────────────────────
  async requestReset(input: RequestPasswordResetInput): Promise<{ token?: string }> {
    const user = await this.users.findByEmail(input.email);
    if (!user) return {}; // no enumeration
    const token = this.tokens.signReset({ sub: user.id });
    const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3600 * 1000);
    await this.resetModel.create({
      userId: user._id,
      tokenHash: this.tokens.hash(token),
      expiresAt,
    });
    return { token };
  }

  async performReset(input: PerformPasswordResetInput): Promise<void> {
    const tokenHash = this.tokens.hash(input.token);
    const record = await this.resetModel.findOne({ tokenHash });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException({ code: ErrorCodes.RESET_INVALID, message: 'Invalid reset link' });
    }
    let payload: { sub: string };
    try {
      payload = this.tokens.verify(input.token, 'reset');
    } catch {
      throw new BadRequestException({ code: ErrorCodes.RESET_INVALID, message: 'Reset expired' });
    }
    const user = await this.users.findByIdOrThrow(payload.sub);
    user.passwordHash = await hashPassword(input.password);
    user.tokenVersion += 1;
    await user.save();
    record.usedAt = new Date();
    await record.save();
    await this.refreshModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  // ── Profile ──────────────────────────────────────────────────────────────────────
  async me(userId: string) {
    const user = await this.users.findByIdOrThrow(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
    };
  }
}
