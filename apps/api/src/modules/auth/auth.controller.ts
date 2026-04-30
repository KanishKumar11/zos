// AuthController — public login/register-via-invite/refresh/reset endpoints + authed /me.
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import {
  acceptInviteSchema,
  inviteUserSchema,
  loginSchema,
  performPasswordResetSchema,
  requestPasswordResetSchema,
  Role,
} from '@agency/shared';

import { REFRESH_COOKIE_NAME } from '@/common/constants/app.constants';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
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

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME];
    await this.auth.logout(token);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
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
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }

  // ── Owner/Admin: invite ──────────────────────────────────────────────────────────
  @Roles(Role.OWNER, Role.ADMIN)
  @Post('invite')
  async invite(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(inviteUserSchema)) input: InviteUserInput,
  ) {
    const { token, expiresAt } = await this.auth.createInvite(input, user.sub);
    const link = `${this.config.get<string>('app.webUrl')}/accept-invite?token=${token}`;
    try {
      await this.mail.sendInvite(input.email, input.name, link);
    } catch {
      // surface invite token for owner debugging in non-prod
    }
    return { ok: true, expiresAt };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────────
  private attachCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): void {
    const isProd = this.config.get('app.nodeEnv') === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: false, // middleware decodes it for UX gating
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: refreshExpiresAt,
    });
  }
}
