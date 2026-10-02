// Client portal API. CLIENT users only, always scoped to their own client company.
// The owner can also preview a project exactly as the client sees it.
import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Role } from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PortalAccess } from '@/common/decorators/portal-access.decorator';
import { RequestTimeout } from '@/common/decorators/request-timeout.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';

import { CollabService } from '../collab/collab.service';
import { PortalService } from './portal.service';

@Controller('portal')
@PortalAccess()
export class PortalController {
  constructor(
    private readonly svc: PortalService,
    private readonly collab: CollabService,
  ) {}

  @Roles(Role.CLIENT)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.svc.me(user.sub);
  }

  @Roles(Role.CLIENT)
  @Get('summary')
  async summary(@CurrentUser() user: JwtPayload) {
    return this.svc.summary(await this.svc.clientIdFor(user.sub));
  }

  @Roles(Role.CLIENT)
  @Get('projects')
  async projects(@CurrentUser() user: JwtPayload) {
    return this.svc.projects(await this.svc.clientIdFor(user.sub));
  }

  @Roles(Role.CLIENT)
  @Get('projects/:id')
  async project(@CurrentUser() user: JwtPayload, @Param('id', ObjectIdPipe) id: string) {
    return this.svc.project(await this.svc.clientIdFor(user.sub), id);
  }

  @Roles(Role.CLIENT)
  @Get('projects/:id/files/:fileId/url')
  async fileUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id', ObjectIdPipe) id: string,
    @Param('fileId', ObjectIdPipe) fileId: string,
  ) {
    return this.svc.fileUrl(await this.svc.clientIdFor(user.sub), id, fileId);
  }

  @Roles(Role.CLIENT)
  @Get('invoices')
  async invoices(@CurrentUser() user: JwtPayload) {
    return this.svc.invoices(await this.svc.clientIdFor(user.sub));
  }

  @Roles(Role.CLIENT)
  @Get('invoices/:id')
  async invoice(@CurrentUser() user: JwtPayload, @Param('id', ObjectIdPipe) id: string) {
    return this.svc.invoice(await this.svc.clientIdFor(user.sub), id);
  }

  @Roles(Role.CLIENT)
  @Get('invoices/:id/pdf')
  @RequestTimeout(60_000)
  async invoicePdf(@CurrentUser() user: JwtPayload, @Param('id', ObjectIdPipe) id: string, @Res() res: Response) {
    const { buffer, filename } = await this.svc.invoicePdf(await this.svc.clientIdFor(user.sub), id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Owner preview ────────────────────────────────────────────────────────────────

  /** The project exactly as its client's portal users see it. */
  @Roles(Role.OWNER)
  @Get('preview/projects/:id')
  async preview(@Param('id', ObjectIdPipe) id: string, @CurrentUser() user: JwtPayload) {
    const project = await this.collab.projectForStaff(id, user);
    if (!project.clientId) return { noClient: true };
    return { ...(await this.svc.project(project.clientId.toString(), id)), portalVisible: project.portalVisible !== false };
  }
}
