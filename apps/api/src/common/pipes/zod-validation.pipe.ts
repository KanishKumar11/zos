// Validates request data against a Zod schema. Use as @UsePipes(new ZodValidationPipe(schema))
// or attach per-arg via @Body(new ZodValidationPipe(schema)) etc.
import { type ArgumentMetadata, BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, infer as ZInfer } from 'zod';

import { ErrorCodes } from '../constants/error-codes';

@Injectable()
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): ZInfer<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
