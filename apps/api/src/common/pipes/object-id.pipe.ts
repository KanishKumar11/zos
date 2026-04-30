// Validates that a route param is a 24-char Mongo ObjectId hex string.
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

import { ErrorCodes } from '../constants/error-codes';

const OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;

@Injectable()
export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!OBJECT_ID_REGEX.test(value)) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid id' });
    }
    return value;
  }
}
