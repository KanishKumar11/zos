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
