// Storage Zod schemas — presign requests are role-gated by route, the schema only validates shape.
import { z } from 'zod';

export const presignPutSchema = z.object({
  prefix: z.string().min(1).max(200).regex(/^[a-zA-Z0-9/_-]+$/, 'invalid prefix'),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200),
});
export type PresignPutInput = z.infer<typeof presignPutSchema>;

export const presignGetSchema = z.object({
  key: z.string().min(1).max(500),
});
export type PresignGetInput = z.infer<typeof presignGetSchema>;
