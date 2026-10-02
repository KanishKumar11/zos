// AuthService — login, logout, refresh rotation, invite issuance/acceptance, password reset.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EVENT_NAMES, Role, UserStatus, canSignIn } from '@agency/shared';

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
    const ok = user ? await comparePassword(input.password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new UnauthorizedException({ code: ErrorCodes.INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }
    // Only reveal the account state once the password has been proven.
    if (!canSignIn(user.status)) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'This account is not active. Contact your workspace owner.',
      });
    }
    // Use updateOne to avoid triggering Mongoose validators on potentially stale enum values.
    await user.updateOne({ lastLoginAt: new Date() });
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

  /** Fresh tokens for an already-authenticated user (e.g. right after a password change). */
  async issueFor(userId: string, meta: { ip?: string; ua?: string }): Promise<IssuedTokens> {
    const user = await this.users.findByIdOrThrow(userId);
    return this.issueTokens(user.id, user.email, user.role, meta);
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

    const user = await this.users.findByIdOrThrow(payload.sub).catch(() => null);
    if (!user || !canSignIn(user.status)) {
      await this.revokeAllSessions(payload.sub);
      throw new UnauthorizedException({ code: ErrorCodes.UNAUTHENTICATED, message: 'Account disabled' });
    }
    return this.issueTokens(user.id, user.email, user.role, meta);
  }

  @OnEvent(EVENT_NAMES.user.accessRevoked)
  async onAccessRevoked(payload: { userId: string }): Promise<void> {
    await this.revokeAllSessions(payload.userId);
  }

  /** Ends every session for a user (deactivation, password reset, token reuse). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
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
  async createInvite(
    input: InviteUserInput | { email: string; name: string; role: Role; departmentId?: string; designationId?: string },
    invitedBy: string,
    extra: { clientId?: string; title?: string } = {},
  ): Promise<{ token: string; expiresAt: Date; inviteId: string }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.EMAIL_TAKEN,
        message:
          existing.role === Role.CLIENT
            ? `${email} already has a client portal login`
            : `${email} already belongs to a team member`,
      });
    }
    // A fresh invite replaces any earlier one, so old links stop working.
    await this.inviteModel.updateMany(
      { email, acceptedAt: { $exists: false }, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    const token = this.tokens.signInvite({ sub: email, email });
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
    const doc = await this.inviteModel.create({
      email,
      name: input.name,
      role: input.role,
      departmentId: input.departmentId,
      designationId: input.designationId,
      clientId: extra.clientId,
      title: extra.title,
      tokenHash: this.tokens.hash(token),
      expiresAt,
      invitedBy,
      lastSentAt: new Date(),
    });
    return { token, expiresAt, inviteId: doc.id };
  }

  /** Open invites (not accepted, not revoked). `expired` tells the UI to offer a resend. */
  async listInvites(filter: { clientId?: string; staffOnly?: boolean } = {}) {
    const query: Record<string, unknown> = { acceptedAt: { $exists: false }, revokedAt: { $exists: false } };
    if (filter.clientId) query.clientId = filter.clientId;
    if (filter.staffOnly) query.role = { $ne: Role.CLIENT };
    const docs = await this.inviteModel.find(query).sort({ createdAt: -1 }).exec();
    const now = new Date();
    return docs.map((d) => ({
      _id: d.id as string,
      email: d.email,
      name: d.name,
      role: d.role,
      title: d.title,
      clientId: d.clientId?.toString(),
      expiresAt: d.expiresAt,
      expired: d.expiresAt < now,
      lastSentAt: d.lastSentAt ?? (d as unknown as { createdAt: Date }).createdAt,
      sendCount: d.sendCount ?? 1,
    }));
  }

  /** New link for an open invite (the old link stops working). */
  async resendInvite(inviteId: string, scope: { clientId?: string } = {}) {
    const invite = await this.inviteModel.findOne({
      _id: inviteId,
      acceptedAt: { $exists: false },
      revokedAt: { $exists: false },
      ...(scope.clientId ? { clientId: scope.clientId } : {}),
    });
    if (!invite) throw new BadRequestException({ code: ErrorCodes.INVITE_INVALID, message: 'This invite is no longer open' });
    const token = this.tokens.signInvite({ sub: invite.email, email: invite.email });
    invite.tokenHash = this.tokens.hash(token);
    invite.expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
    invite.lastSentAt = new Date();
    invite.sendCount = (invite.sendCount ?? 1) + 1;
    await invite.save();
    return { token, email: invite.email, name: invite.name, clientId: invite.clientId?.toString(), expiresAt: invite.expiresAt };
  }

  async revokeInvite(inviteId: string, scope: { clientId?: string } = {}) {
    const res = await this.inviteModel.updateOne(
      { _id: inviteId, acceptedAt: { $exists: false }, ...(scope.clientId ? { clientId: scope.clientId } : {}) },
      { $set: { revokedAt: new Date() } },
    );
    if (!res.matchedCount) throw new BadRequestException({ code: ErrorCodes.INVITE_INVALID, message: 'Invite not found' });
    return { ok: true };
  }

  async acceptInvite(input: AcceptInviteInput): Promise<{ userId: string }> {
    const tokenHash = this.tokens.hash(input.token);
    const invite = await this.inviteModel.findOne({ tokenHash });
    if (!invite || invite.acceptedAt || invite.revokedAt) {
      throw new BadRequestException({
        code: ErrorCodes.INVITE_INVALID,
        message: 'This invite link is no longer valid. Ask for a new invite, or sign in if you already set a password.',
      });
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException({ code: ErrorCodes.INVITE_INVALID, message: 'This invite link has expired. Ask for a new one.' });
    }
    if (await this.users.findByEmail(invite.email)) {
      throw new ConflictException({ code: ErrorCodes.EMAIL_TAKEN, message: 'An account with this email already exists. Please sign in.' });
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
      clientId: invite.clientId,
      title: invite.title,
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

  /** Signed-in password change. Ends every other session. */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findByIdOrThrow(userId);
    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Current password is incorrect',
        details: { fieldErrors: { currentPassword: ['Current password is incorrect'] } },
      });
    }
    user.passwordHash = await hashPassword(newPassword);
    user.tokenVersion += 1;
    await user.save();
    await this.revokeAllSessions(user.id);
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
      clientId: user.clientId?.toString() ?? null,
    };
  }
}
