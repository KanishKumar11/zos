// Tasks Zod schemas.
import { z } from 'zod';

import { TaskPriority, TaskStatus } from '../enums';
import { isoDateSchema, objectIdSchema } from './common.schema';

export const createTaskSchema = z.object({
  projectId: objectIdSchema,
  title: z.string().min(2).max(200),
  description: z.string().max(20_000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: objectIdSchema.optional(),
  dueDate: isoDateSchema.optional(),
  parentId: objectIdSchema.optional(),
  labels: z.array(z.string().max(40)).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(20_000).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    assigneeId: objectIdSchema.nullable().optional(),
    dueDate: isoDateSchema.nullable().optional(),
    labels: z.array(z.string().max(40)).optional(),
    attachmentKeys: z.array(z.string()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  position: z.number(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const listTasksQuerySchema = z.object({
  projectId: objectIdSchema.optional(),
  assigneeId: objectIdSchema.optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  mine: z.coerce.boolean().optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(10_000),
  mentions: z.array(objectIdSchema).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const createTimeEntrySchema = z.object({
  projectId: objectIdSchema,
  taskId: objectIdSchema.optional(),
  date: isoDateSchema,
  minutes: z.number().int().min(1).max(24 * 60),
  description: z.string().max(2000).optional(),
  billable: z.boolean().optional(),
});
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
