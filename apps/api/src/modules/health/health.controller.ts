// Liveness/readiness endpoint, marked @Public so it bypasses the global JWT guard.
import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }
}
