// Department / designation Zod schemas.
import { z } from 'zod';

import { objectIdSchema } from './common.schema';

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  headUserId: objectIdSchema.optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const createDesignationSchema = z.object({
  title: z.string().min(2).max(80),
  departmentId: objectIdSchema,
  description: z.string().max(500).optional(),
  seniorityLevel: z.number().int().min(1).max(10).optional(),
});
export const updateDesignationSchema = createDesignationSchema.partial();
export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;
