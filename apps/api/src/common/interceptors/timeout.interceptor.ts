// Aborts requests that exceed the configured timeout, returning RequestTimeoutException.
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { type Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

import { DEFAULT_REQUEST_TIMEOUT_MS } from '../constants/app.constants';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms: number = DEFAULT_REQUEST_TIMEOUT_MS) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) =>
        err instanceof TimeoutError ? throwError(() => new RequestTimeoutException()) : throwError(() => err),
      ),
    );
  }
}
