// [SHARED] Currency constants. Internally amounts are stored as integers in the smallest unit
// (paise for INR). Frontend converts to display units via formatters.
export const DEFAULT_CURRENCY = 'INR';
export const PAISE_PER_RUPEE = 100;
export const SUPPORTED_CURRENCIES: readonly string[] = ['INR', 'USD', 'EUR', 'GBP'] as const;
