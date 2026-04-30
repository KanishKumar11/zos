// [SHARED] CRM pipeline stage for a client/lead.
export enum CrmStage {
  LEAD = 'LEAD',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

export const CRM_STAGE_ORDER: readonly CrmStage[] = [
  CrmStage.LEAD,
  CrmStage.QUALIFIED,
  CrmStage.PROPOSAL,
  CrmStage.NEGOTIATION,
  CrmStage.WON,
  CrmStage.LOST,
] as const;
