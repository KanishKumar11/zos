// Maps mongo driver errors (duplicate key, validation, cast) to HttpException equivalents.
import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  type ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Error as MongooseError, mongo } from 'mongoose';

import { ErrorCodes } from '../constants/error-codes';

import { HttpExceptionFilter } from './http-exception.filter';

@Catch(mongo.MongoServerError, MongooseError.ValidationError, MongooseError.CastError, MongooseError.DocumentNotFoundError)
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly delegate = new HttpExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    let mapped: Error;
    if (exception instanceof mongo.MongoServerError && exception.code === 11000) {
      mapped = new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: 'Duplicate key',
        details: exception.keyValue,
      });
    } else if (exception instanceof MongooseError.ValidationError) {
      mapped = new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: exception.errors,
      });
    } else if (exception instanceof MongooseError.CastError) {
      mapped = new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Invalid ${exception.path}`,
      });
    } else if (exception instanceof MongooseError.DocumentNotFoundError) {
      mapped = new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Document not found' });
    } else {
      mapped = exception as Error;
    }
    this.delegate.catch(mapped, host);
  }
}
