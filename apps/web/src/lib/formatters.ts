// Reusable input/select formatters and money helpers for the UI layer.
export const formatMoney = (paise: number, currency = 'INR'): string => {
  const major = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(major);
};

export const formatPaise = formatMoney;

/** Rupee input (major units) → paise, the unit every money field is stored in. */
export const toPaise = (rupees: number | string | undefined | null): number => {
  const n = typeof rupees === 'string' ? Number(rupees) : (rupees ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Paise → rupees, for populating a rupee-denominated input. */
export const toRupees = (paise: number | undefined | null): number =>
  Math.round(paise ?? 0) / 100;

export const formatDate = (input: string | Date, opts?: Intl.DateTimeFormatOptions): string => {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-IN', opts ?? { dateStyle: 'medium' }).format(d);
};

export const formatDateTime = (input: string | Date): string =>
  formatDate(input, { dateStyle: 'medium', timeStyle: 'short' });

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
