// Persists an audit log entry whenever a route is decorated with @Audit(action). The
// AuditService is injected lazily via ModuleRef to keep the global interceptor cycle-free.
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { type Observable, tap } from 'rxjs';

import type { AuditAction } from '@agency/shared';

import { AUDIT_KEY } from '../decorators/audit.decorator';
import type { AuthedRequest } from '../interfaces/authed-request.interface';

/** Public contract that AuditService implements. */
export interface IAuditWriter {
  record(entry: {
    userId: string;
    userRole: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
}

export const AUDIT_WRITER = Symbol('AUDIT_WRITER');

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<AuditAction | undefined>(AUDIT_KEY, context.getHandler());
    if (!action) return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    return next.handle().pipe(
      tap(() => {
        void this.write(action, req);
      }),
    );
  }

  private async write(action: AuditAction, req: AuthedRequest): Promise<void> {
    try {
      const writer = this.moduleRef.get<IAuditWriter>(AUDIT_WRITER, { strict: false });
      if (!writer) return;
      await writer.record({
        userId: req.user.sub,
        userRole: req.user.role,
        action,
        resource: req.route?.path ?? req.url,
        resourceId: req.params?.id,
        metadata: { method: req.method, query: req.query, body: req.body },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
    } catch (err) {
      this.logger.warn(`audit write failed: ${(err as Error).message}`);
    }
  }
}
