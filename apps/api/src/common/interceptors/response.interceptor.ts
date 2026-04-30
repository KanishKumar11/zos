// Wraps every successful controller return value in { success: true, data, meta? }.
// If the controller returns { items, meta }, it is unpacked into data + meta.
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';

import type { ApiSuccess, Paginated, PaginationMeta } from '@agency/shared';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<unknown>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<unknown>> {
    return next.handle().pipe(
      map((value) => {
        if (this.isPaginated(value)) {
          return { success: true, data: value.items, meta: value.meta };
        }
        return { success: true, data: value };
      }),
    );
  }

  private isPaginated(value: unknown): value is Paginated<unknown> & { meta: PaginationMeta } {
    return (
      typeof value === 'object' &&
      value !== null &&
      Array.isArray((value as Paginated<unknown>).items) &&
      typeof (value as Paginated<unknown>).meta === 'object'
    );
  }
}
