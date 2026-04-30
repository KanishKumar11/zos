// Leave event payload types.
export interface LeaveRequestedEvent {
  leaveId: string;
  userId: string;
  approverIds: string[];
}

export interface LeaveReviewedEvent {
  leaveId: string;
  userId: string;
  reviewerId: string;
  approved: boolean;
  reviewNote?: string;
}
