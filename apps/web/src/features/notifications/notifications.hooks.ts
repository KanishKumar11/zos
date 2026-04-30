// Announcements + notifications API + hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AudienceType,
  NotificationType,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface AnnouncementRow {
  _id: string;
  title: string;
  body: string;
  audienceType: AudienceType;
  audienceIds: string[];
  pinned: boolean;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
}
export interface NotificationRow {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  linkPath?: string;
  readAt?: string;
  createdAt: string;
}

export const announcementsApi = {
  list: () => unwrap<AnnouncementRow[]>(api.get('/announcements')),
  byId: (id: string) => unwrap<AnnouncementRow>(api.get(`/announcements/${id}`)),
  create: (body: CreateAnnouncementInput) => unwrap<AnnouncementRow>(api.post('/announcements', body)),
  update: (id: string, body: UpdateAnnouncementInput) =>
    unwrap<AnnouncementRow>(api.patch(`/announcements/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/announcements/${id}`)),
};

export const notificationsApi = {
  inbox: () => unwrap<NotificationRow[]>(api.get('/notifications')),
  unreadCount: () => unwrap<{ count: number }>(api.get('/notifications/unread-count')),
  markRead: (ids: string[]) =>
    unwrap<{ matched: number }>(api.post('/notifications/read', { ids })),
  markAllRead: () => unwrap<{ matched: number }>(api.post('/notifications/read-all', {})),
};

export function useAnnouncements() {
  return useQuery({ queryKey: qk.announcements.feed(), queryFn: announcementsApi.list });
}
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAnnouncementInput) => announcementsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Announcement published');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications.inbox(), queryFn: notificationsApi.inbox });
}
export function useUnreadCount() {
  return useQuery({
    queryKey: qk.notifications.unreadCount(),
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
  });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
