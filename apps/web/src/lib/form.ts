// Form helpers shared by every react-hook-form screen.
//
// HTML inputs submit '' for "nothing entered", and `valueAsNumber` turns an empty box into NaN.
// Both fail optional zod fields with no visible error, which is what made Save "do nothing".
// Register optional fields with these instead:
//   register('dueDate', { setValueAs: emptyToUndefined })
//   register('seniority', { setValueAs: emptyToUndefinedNumber })
import type { FieldErrors, FieldValues } from 'react-hook-form';

export const emptyToUndefined = (v: unknown): string | undefined =>
  v === '' || v === null || v === undefined ? undefined : String(v);

export const emptyToUndefinedNumber = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

/** First error message for a (possibly nested, dot-separated) field name. */
export function fieldError<T extends FieldValues>(errors: FieldErrors<T>, name: string): string | undefined {
  let node: unknown = errors;
  for (const part of name.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : undefined;
}

/** Today's date as yyyy-mm-dd in the user's own timezone (toISOString() is UTC and can be "yesterday"). */
export const todayLocal = (): string => toLocalDateInput(new Date());

export const toLocalDateInput = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Current month as yyyy-mm in local time. */
export const thisMonthLocal = (): string => todayLocal().slice(0, 7);
