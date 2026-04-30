// Strips owner-only fields from any non-OWNER response. Triggered by @SerializeResource('xxx')
// decorator on controller class/method, looked up against OWNER_ONLY_FIELDS map.
import {
  type CallHandler,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, map } from 'rxjs';

import { OWNER_ONLY_FIELDS } from '../constants/owner-only-fields';
import { OWNER_ONLY_KEY, SERIALIZE_RESOURCE_KEY } from '../decorators/owner-only.decorator';
import type { AuthedRequest } from '../interfaces/authed-request.interface';
import { Role } from '../types/role.type';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const role = request.user?.role;

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const resource = this.reflector.getAllAndOverride<string | undefined>(SERIALIZE_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((value) => {
        if (role === Role.OWNER) return value;
        if (ownerOnly) {
          throw new ForbiddenException({ code: 'OWNER_ONLY', message: 'Owner-only resource' });
        }
        if (!resource) return value;
        const fields = OWNER_ONLY_FIELDS[resource];
        if (!fields || fields.length === 0) return value;
        return this.strip(value, fields);
      }),
    );
  }

  private strip(value: unknown, fields: readonly string[]): unknown {
    if (Array.isArray(value)) return value.map((v) => this.strip(v, fields));
    if (this.isPaginated(value)) {
      return { ...value, items: value.items.map((v: unknown) => this.strip(v, fields)) };
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
      if (fields.includes('*')) return null;
      for (const f of fields) delete out[f];
      return out;
    }
    return value;
  }

  private isPaginated(v: unknown): v is { items: unknown[]; meta: unknown } {
    return typeof v === 'object' && v !== null && Array.isArray((v as { items?: unknown }).items);
  }
}
