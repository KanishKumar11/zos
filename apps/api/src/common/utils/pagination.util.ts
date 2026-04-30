// Builds a Paginated<T> response from items + total + pagination input.
import type { Paginated, PaginationMeta } from '@agency/shared';

import type { PaginationDto } from '../dto/pagination.dto';

export type { Paginated } from '@agency/shared';

export function paginate<T>(
  items: T[],
  total: number,
  pageOrInput: number | PaginationDto,
  pageSize?: number,
): Paginated<T> {
  const page = typeof pageOrInput === 'number' ? pageOrInput : pageOrInput.page;
  const limit = typeof pageOrInput === 'number' ? pageSize ?? 20 : pageOrInput.limit;
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
  return { items, meta };
}
