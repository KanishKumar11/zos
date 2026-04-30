// Currency arithmetic for paise-based integer storage.
import { PAISE_PER_RUPEE } from '@agency/shared';

/** Convert a major-unit number (e.g. 12.34 rupees) to paise integer (1234). */
export const toPaise = (major: number): number => Math.round(major * PAISE_PER_RUPEE);

/** Convert paise integer (1234) to major units (12.34). */
export const toMajor = (paise: number): number => paise / PAISE_PER_RUPEE;

/** Sum a list of paise amounts safely. */
export const sumPaise = (values: readonly number[]): number =>
  values.reduce((acc, v) => acc + Math.round(v), 0);
