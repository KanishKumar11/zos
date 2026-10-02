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

export const CRM_STAGE_LABEL: Record<CrmStage, string> = {
  [CrmStage.LEAD]: 'Lead',
  [CrmStage.QUALIFIED]: 'Qualified',
  [CrmStage.PROPOSAL]: 'Proposal',
  [CrmStage.NEGOTIATION]: 'Negotiation',
  [CrmStage.WON]: 'Won',
  [CrmStage.LOST]: 'Lost',
};

/** Win probability (%) assumed for a deal that has none of its own. */
export const CRM_STAGE_PROBABILITY: Record<CrmStage, number> = {
  [CrmStage.LEAD]: 10,
  [CrmStage.QUALIFIED]: 25,
  [CrmStage.PROPOSAL]: 50,
  [CrmStage.NEGOTIATION]: 75,
  [CrmStage.WON]: 100,
  [CrmStage.LOST]: 0,
};

/** Stages where the deal is still being worked (counts towards the weighted pipeline). */
export const CRM_OPEN_STAGES: readonly CrmStage[] = [
  CrmStage.LEAD,
  CrmStage.QUALIFIED,
  CrmStage.PROPOSAL,
  CrmStage.NEGOTIATION,
] as const;
