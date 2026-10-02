// Owner-side management of a client's portal users: invite, resend, revoke, disable, enable.
import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { z } from 'zod';

import { AuditAction, EVENT_NAMES, Role, UserStatus } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { emitAudit } from '@/common/utils/audit.util';

import { AuthService } from '../auth/services/auth.service';
import { Client, type ClientDocument } from '../clients/schemas/client.schema';
import { MailService } from '../mail/mail.service';
import { User, type UserDocument } from '../users/schemas/user.schema';

const invitePortalUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  name: z.string().trim().min(2, 'Enter their name').max(120),
  title: z.string().trim().max(120).optional(),
});
type InvitePortalUserInput = z.infer<typeof invitePortalUserSchema>;

@Controller('clients/:clientId/portal')
@Roles(Role.OWNER)
export class PortalAdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
  ) {}

  private async client(clientId: string) {
    const c = await this.clients.findOne({ _id: clientId, deletedAt: { $exists: false } }).exec();
    if (!c) throw new NotFoundException({ code: ErrorCodes.CLIENT_NOT_FOUND, message: 'Client not found' });
    return c;
  }

  @Get()
  async overview(@Param('clientId', ObjectIdPipe) clientId: string) {
    await this.client(clientId);
    const [users, invites] = await Promise.all([
      this.users
        .find({ role: Role.CLIENT, clientId: new Types.ObjectId(clientId), deletedAt: { $exists: false } })
        .select('name email title status lastLoginAt createdAt')
        .sort({ name: 1 })
        .exec(),
      this.auth.listInvites({ clientId }),
    ]);
    return {
      users: users.map((u) => ({
        _id: u.id as string,
        name: u.name,
        email: u.email,
        title: u.title,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
      })),
      invites,
    };
  }

  @Post('invite')
  async invite(
    @Param('clientId', ObjectIdPipe) clientId: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(invitePortalUserSchema)) body: InvitePortalUserInput,
  ) {
    const client = await this.client(clientId);
    const { token, expiresAt } = await this.auth.createInvite(
      { email: body.email, name: body.name, role: Role.CLIENT },
      actor.sub,
      { clientId, title: body.title },
    );
    const emailed = await this.send(body.email, body.name, token, client.name);
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PORTAL_USER_INVITED,
      entity: 'client',
      entityId: clientId,
      summary: `${body.name} <${body.email}> invited to the ${client.name} portal`,
    });
    return { ok: true, expiresAt, emailed };
  }

  @Post('invites/:inviteId/resend')
  async resend(@Param('clientId', ObjectIdPipe) clientId: string, @Param('inviteId', ObjectIdPipe) inviteId: string) {
    const client = await this.client(clientId);
    const r = await this.auth.resendInvite(inviteId, { clientId });
    const emailed = await this.send(r.email, r.name, r.token, client.name);
    return { ok: true, expiresAt: r.expiresAt, emailed };
  }

  @Delete('invites/:inviteId')
  revokeInvite(@Param('clientId', ObjectIdPipe) clientId: string, @Param('inviteId', ObjectIdPipe) inviteId: string) {
    return this.auth.revokeInvite(inviteId, { clientId });
  }

  @Post('users/:userId/disable')
  async disable(
    @Param('clientId', ObjectIdPipe) clientId: string,
    @Param('userId', ObjectIdPipe) userId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    const u = await this.portalUser(clientId, userId);
    u.status = UserStatus.SUSPENDED;
    u.tokenVersion += 1;
    await u.save();
    this.events.emit(EVENT_NAMES.user.accessRevoked, { userId });
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PORTAL_ACCESS_REVOKED,
      entity: 'client',
      entityId: clientId,
      summary: `${u.name} <${u.email}> can no longer sign in to the portal`,
    });
    return { ok: true };
  }

  @Post('users/:userId/enable')
  async enable(@Param('clientId', ObjectIdPipe) clientId: string, @Param('userId', ObjectIdPipe) userId: string) {
    const u = await this.portalUser(clientId, userId);
    u.status = UserStatus.ACTIVE;
    await u.save();
    return { ok: true };
  }

  private async portalUser(clientId: string, userId: string) {
    const u = await this.users
      .findOne({ _id: userId, role: Role.CLIENT, clientId: new Types.ObjectId(clientId), deletedAt: { $exists: false } })
      .exec();
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Portal user not found' });
    return u;
  }

  private async send(email: string, name: string, token: string, clientName: string): Promise<boolean> {
    const link = `${this.config.get<string>('app.webUrl')}/accept-invite?token=${token}`;
    try {
      await this.mail.sendInvite(email, name, link, { portalFor: clientName });
      return true;
    } catch {
      return false;
    }
  }
}
