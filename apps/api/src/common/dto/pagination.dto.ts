// Pagination DTO derived from the shared Zod schema.
import type { PaginationQuery } from '@agency/shared';

export type PaginationDto = PaginationQuery;

/** Compute mongoose-friendly skip from page/limit. */
export const toSkip = (p: PaginationDto): number => (p.page - 1) * p.limit;
