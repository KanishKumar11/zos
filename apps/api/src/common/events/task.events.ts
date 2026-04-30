// Task event payload types.
export interface TaskAssignedEvent {
  taskId: string;
  projectId: string;
  assigneeIds: string[];
  assignedBy: string;
}

export interface TaskCommentedEvent {
  taskId: string;
  commentId: string;
  authorId: string;
  mentionedUserIds: string[];
}

export interface TaskStatusChangedEvent {
  taskId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
}
