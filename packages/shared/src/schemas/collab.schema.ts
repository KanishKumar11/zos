// Project updates + files (shared with the team and, optionally, the client portal).
import { z } from 'zod';

export const CONTENT_VISIBILITY = ['INTERNAL', 'CLIENT'] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITY)[number];

export const createProjectUpdateSchema = z.object({
  title: z.string().trim().min(2, 'Add a short title').max(160),
  body: z.string().trim().min(1, 'Write the update').max(10_000),
  visibility: z.enum(CONTENT_VISIBILITY).default('INTERNAL'),
  /** Project files to attach (must already belong to the project). */
  fileIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(10).optional(),
});
export type CreateProjectUpdateInput = z.input<typeof createProjectUpdateSchema>;

export const updateProjectUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    body: z.string().trim().min(1).max(10_000).optional(),
    visibility: z.enum(CONTENT_VISIBILITY).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateProjectUpdateInput = z.infer<typeof updateProjectUpdateSchema>;

/** Max upload size for project files (50 MB). */
export const PROJECT_FILE_MAX_BYTES = 50 * 1024 * 1024;

export const presignProjectFileSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200),
  sizeBytes: z.number().int().min(1).max(PROJECT_FILE_MAX_BYTES, 'Files can be up to 50 MB'),
});
export type PresignProjectFileInput = z.infer<typeof presignProjectFileSchema>;

export const registerProjectFileSchema = z.object({
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  contentType: z.string().max(200).optional(),
  sizeBytes: z.number().int().min(0).max(PROJECT_FILE_MAX_BYTES).optional(),
  visibility: z.enum(CONTENT_VISIBILITY).default('INTERNAL'),
  description: z.string().max(300).optional(),
});
export type RegisterProjectFileInput = z.input<typeof registerProjectFileSchema>;

export const updateProjectFileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  visibility: z.enum(CONTENT_VISIBILITY).optional(),
  description: z.string().max(300).optional(),
});
export type UpdateProjectFileInput = z.infer<typeof updateProjectFileSchema>;
