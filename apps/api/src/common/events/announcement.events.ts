// Announcement event payload types.
export interface AnnouncementPostedEvent {
  announcementId: string;
  postedBy: string;
  audienceType: string;
  audienceTargetIds?: string[];
}
