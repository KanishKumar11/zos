// Other-income categories and labels.
export const INCOME_CATEGORIES = ['AFFILIATE', 'REFERRAL', 'INTEREST', 'REFUND', 'OTHER'] as const;

export const INCOME_CATEGORY_LABEL: Record<string, string> = {
  AFFILIATE: 'Affiliate',
  REFERRAL: 'Referral',
  INTEREST: 'Interest',
  REFUND: 'Refund',
  OTHER: 'Other',
};

export const incomeCategoryLabel = (c: string): string => INCOME_CATEGORY_LABEL[c] ?? c;

/** How a category reads mid-sentence: "mostly from referrals". */
const INCOME_CATEGORY_PHRASE: Record<string, string> = {
  AFFILIATE: 'affiliate payouts',
  REFERRAL: 'referrals',
  INTEREST: 'interest',
  REFUND: 'refunds',
  OTHER: 'other sources',
};

export const incomeCategoryPhrase = (c: string): string => INCOME_CATEGORY_PHRASE[c] ?? incomeCategoryLabel(c).toLowerCase();
