// [SHARED] Reusable Zod primitives used across all module schemas.
import { z } from 'zod';

import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SUPPORTED_CURRENCIES } from '../constants';

/** 24-char Mongo ObjectId hex string. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'Invalid id');

/** ISO 8601 date string, coerced to Date. */
export const isoDateSchema = z.coerce.date();

/** Standard pagination query (?page&limit&sortBy&order). */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sortBy: z.string().min(1).max(64).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Inclusive date range with from <= to. */
export const dateRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((v) => v.to >= v.from, { message: '`to` must be on or after `from`', path: ['to'] });

/** ISO 4217 currency string. */
export const currencySchema = z
  .string()
  .length(3)
  .toUpperCase()
  .refine((v) => (SUPPORTED_CURRENCIES as readonly string[]).includes(v), {
    message: 'Unsupported currency',
  });

/** Money amount stored as integer (paise/cents). */
export const moneySchema = z.object({
  amount: z.number().int().min(0),
  currency: currencySchema,
});

/** Email field (lowercased). */
export const emailSchema = z.string().email().toLowerCase().trim();

/** Strong password (min 8 chars, at least one letter and one number). */
export const passwordSchema = z
  .string()
  .min(8, 'Min 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number');

/** Phone (E.164-ish, lenient). */
export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number');
