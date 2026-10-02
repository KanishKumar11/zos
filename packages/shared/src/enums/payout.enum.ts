// [SHARED] Payouts ledger enums — money the agency pays out to team members and freelancers.
export enum PayeeType {
  MEMBER = 'MEMBER',
  FREELANCER = 'FREELANCER',
}

export enum PayoutMethod {
  BANK = 'BANK',
  UPI = 'UPI',
  CASH = 'CASH',
  CARD = 'CARD',
  OTHER = 'OTHER',
}

export enum PayoutCategory {
  PROJECT_FEE = 'PROJECT_FEE',
  ADVANCE = 'ADVANCE',
  BONUS = 'BONUS',
  REIMBURSEMENT = 'REIMBURSEMENT',
  OTHER = 'OTHER',
}

export const PAYOUT_METHOD_LABEL: Record<PayoutMethod, string> = {
  BANK: 'Bank transfer',
  UPI: 'UPI',
  CASH: 'Cash',
  CARD: 'Card',
  OTHER: 'Other',
};

export const PAYOUT_CATEGORY_LABEL: Record<PayoutCategory, string> = {
  PROJECT_FEE: 'Project fee',
  ADVANCE: 'Advance',
  BONUS: 'Bonus',
  REIMBURSEMENT: 'Reimbursement',
  OTHER: 'Other',
};
