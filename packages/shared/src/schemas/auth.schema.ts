// Auth Zod schemas — login, refresh, accept invite, request reset, perform reset.
import { z } from 'zod';

import { Role } from '../enums/roles.enum';

import { emailSchema, passwordSchema } from './common.schema';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
  name: z.string().min(2).optional(),
  phone: z.string().min(7).max(20).optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const requestPasswordResetSchema = z.object({ email: emailSchema });
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const performPasswordResetSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });
export type PerformPasswordResetInput = z.infer<typeof performPasswordResetSchema>;

export const inviteUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2),
  role: z.nativeEnum(Role),
  departmentId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  designationId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
