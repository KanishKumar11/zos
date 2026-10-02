// AuthController — public login/register-via-invite/refresh/reset endpoints + authed /me.
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request, Response } from 'express';

import {
  acceptInviteSchema,
  changePasswordSchema,
  inviteUserSchema,
  type ChangePasswordInput,
  loginSchema,
  performPasswordResetSchema,
  requestPasswordResetSchema,
  AuditAction,
  Role,
} from '@agency/shared';
import { emitAudit } from '@/common/utils/audit.util';

import { REFRESH_COOKIE_NAME } from '@/common/constants/app.constants';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PortalAccess } from '@/common/decorators/portal-access.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import type {
  AcceptInviteInput,
  InviteUserInput,
  LoginInput,
  PerformPasswordResetInput,
  RequestPasswordResetInput,
} from './dto/auth.dto';
import { AuthService } from './services/auth.service';
import { MailService } from '../mail/mail.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(input, { ip: req.ip, ua: req.get('user-agent') ?? undefined });
    this.attachCookies(res, tokens.accessToken, tokens.refreshToken, tokens.refreshExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = REFRESH_COOKIE_NAME;
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[cookieName];
    if (!token) return { accessToken: null };
    const tokens = await this.auth.refresh(token, { ip: req.ip, ua: req.get('user-agent') ?? undefined });
    this.attachCookies(res, tokens.accessToken, tokens.refreshToken, tokens.refreshExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  @PortalAccess()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME];
    await this.auth.logout(token);
    const domain = this.config.get<string | undefined>('app.cookieDomain');
    const cookieOpts = { path: '/', ...(domain ? { domain } : {}) };
    res.clearCookie('access_token', cookieOpts);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOpts);
  }

  @Public()
  @Post('accept-invite')
  acceptInvite(@Body(new ZodValidationPipe(acceptInviteSchema)) input: AcceptInviteInput) {
    return this.auth.acceptInvite(input);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgot(@Body(new ZodValidationPipe(requestPasswordResetSchema)) input: RequestPasswordResetInput) {
    const { token } = await this.auth.requestReset(input);
    if (token) {
      const link = `${this.config.get<string>('app.webUrl')}/reset-password?token=${token}`;
      try {
        await this.mail.sendResetLink(input.email, link);
      } catch {
        // don't leak mail failures during password reset
      }
    }
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async reset(@Body(new ZodValidationPipe(performPasswordResetSchema)) input: PerformPasswordResetInput) {
    await this.auth.performReset(input);
    return { ok: true };
  }

  // ── Authed ───────────────────────────────────────────────────────────────────────
  @PortalAccess()
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  /** Change password while signed in; other sessions are signed out, this one gets fresh tokens. */
  @PortalAccess()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(changePasswordSchema)) input: ChangePasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(user.sub, input.currentPassword, input.newPassword);
    const tokens = await this.auth.issueFor(user.sub, { ip: req.ip, ua: req.get('user-agent') ?? undefined });
    this.attachCookies(res, tokens.accessToken, tokens.refreshToken, tokens.refreshExpiresAt);
    return { ok: true };
  }

  // ── Owner/Admin: invite ──────────────────────────────────────────────────────────
  @Roles(Role.OWNER, Role.ADMIN)
  @Post('invite')
  async invite(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(inviteUserSchema)) input: InviteUserInput,
  ) {
    const { token, expiresAt, inviteId } = await this.auth.createInvite(input, user.sub);
    const emailed = await this.sendInviteMail(input.email, input.name, token);
    emitAudit(this.events, {
      actorId: user.sub,
      action: AuditAction.MEMBER_INVITED,
      entity: 'invite',
      entityId: inviteId,
      summary: `Invited ${input.name} <${input.email}> as ${input.role.toLowerCase()}${emailed ? '' : ' (email not sent)'}`,
    });
    return { ok: true, expiresAt, emailed, inviteId };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('invites')
  invites() {
    return this.auth.listInvites({ staffOnly: true });
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post('invites/:id/resend')
  async resendInvite(@Param('id', ObjectIdPipe) id: string) {
    const r = await this.auth.resendInvite(id);
    const emailed = await this.sendInviteMail(r.email, r.name, r.token);
    return { ok: true, expiresAt: r.expiresAt, emailed };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete('invites/:id')
  revokeInvite(@Param('id', ObjectIdPipe) id: string) {
    return this.auth.revokeInvite(id);
  }

  /** Emails an invite link. Returns false (instead of failing the request) when mail is down. */
  private async sendInviteMail(email: string, name: string, token: string, portalFor?: string): Promise<boolean> {
    const link = `${this.config.get<string>('app.webUrl')}/accept-invite?token=${token}`;
    try {
      await this.mail.sendInvite(email, name, link, { portalFor });
      return true;
    } catch {
      return false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────────
  private attachCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): void {
    const isProd = this.config.get('app.nodeEnv') === 'production';
    const domain = this.config.get<string | undefined>('app.cookieDomain');
    res.cookie('access_token', accessToken, {
      httpOnly: false, // middleware decodes it for UX gating
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
      ...(domain ? { domain } : {}),
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: refreshExpiresAt,
      ...(domain ? { domain } : {}),
    });
  }
}
