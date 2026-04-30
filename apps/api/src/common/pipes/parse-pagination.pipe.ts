// Convenience pipe that parses ?page&limit&sortBy&order using the shared schema.
import { Injectable } from '@nestjs/common';

import { paginationQuerySchema } from '@agency/shared';

import { ZodValidationPipe } from './zod-validation.pipe';

@Injectable()
export class ParsePaginationPipe extends ZodValidationPipe<typeof paginationQuerySchema> {
  constructor() {
    super(paginationQuerySchema);
  }
}
