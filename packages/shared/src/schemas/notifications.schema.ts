// Announcement + Notification schemas.
import { z } from 'zod';

import { AudienceType, NotificationType } from '../enums';
import { objectIdSchema } from './common.schema';

const announcementBaseSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(2),
  audienceType: z.nativeEnum(AudienceType).default(AudienceType.ALL),
  audienceIds: z.array(objectIdSchema).optional(),
  pinned: z.boolean().optional(),
});

export const createAnnouncementSchema = announcementBaseSchema.superRefine((v, ctx) => {
  if (v.audienceType !== AudienceType.ALL && (!v.audienceIds || v.audienceIds.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'audienceIds required for non-ALL audience' });
  }
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = announcementBaseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const createNotificationSchema = z.object({
  userId: objectIdSchema,
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  data: z.record(z.string(), z.any()).optional(),
  linkPath: z.string().max(500).optional(),
});
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
