// Aborts requests that exceed the configured timeout, returning RequestTimeoutException.
// Per-handler override: @RequestTimeout(ms) decorator sets a custom limit.
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

import { DEFAULT_REQUEST_TIMEOUT_MS, TIMEOUT_METADATA_KEY } from '../constants/app.constants';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms =
      this.reflector.get<number>(TIMEOUT_METADATA_KEY, context.getHandler()) ??
      DEFAULT_REQUEST_TIMEOUT_MS;
    return next.handle().pipe(
      timeout(ms),
      catchError((err) =>
        err instanceof TimeoutError ? throwError(() => new RequestTimeoutException()) : throwError(() => err),
      ),
    );
  }
}
