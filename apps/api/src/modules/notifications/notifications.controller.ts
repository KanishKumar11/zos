// Notifications controller — own inbox only.
import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  inbox(@CurrentUser() user: JwtPayload) {
    return this.svc.inbox(user.sub);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: JwtPayload) {
    return this.svc.unreadCount(user.sub).then((count) => ({ count }));
  }

  @Post('read')
  markRead(@CurrentUser() user: JwtPayload, @Body() body: { ids: string[] }) {
    return this.svc.markRead(user.sub, body.ids ?? []);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.svc.markAllRead(user.sub);
  }
}
