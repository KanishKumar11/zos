// Global HTTP exception filter — converts every error into a typed ApiError envelope.
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import type { ApiError } from '@agency/shared';

import { ErrorCodes } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? exception.message;
        code = (r.code as string) ?? this.codeForStatus(status);
        details = r.details;
      }
      if (!code || code === ErrorCodes.INTERNAL_ERROR) code = this.codeForStatus(status);
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack ?? exception.message);
      message = exception.message;
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    const body: ApiError = {
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    };
    response.status(status).json(body);
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return ErrorCodes.VALIDATION_ERROR;
      case 401:
        return ErrorCodes.UNAUTHENTICATED;
      case 403:
        return ErrorCodes.FORBIDDEN;
      case 404:
        return ErrorCodes.NOT_FOUND;
      case 409:
        return ErrorCodes.CONFLICT;
      case 429:
        return ErrorCodes.RATE_LIMITED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
