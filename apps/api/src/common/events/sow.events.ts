// SOW event payload types.
export interface SowMilestoneReceivedEvent {
  sowId: string;
  milestoneId: string;
  amount: number;
  receivedAt: Date;
}

export interface SowBriefPublishedEvent {
  sowId: string;
  projectId: string;
  visibleToRoles: readonly string[];
}
