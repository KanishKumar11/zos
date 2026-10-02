// Auth Zod schemas — login, refresh, accept invite, request reset, perform reset.
import { z } from 'zod';

import { Role, isStaffRole } from '../enums/roles.enum';

import { emailSchema, passwordSchema } from './common.schema';

/** Treat '' (an untouched optional input) as "not provided". */
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
  name: blankToUndefined(z.string().trim().min(2, 'Name must be at least 2 characters')),
  phone: blankToUndefined(z.string().trim().min(7, 'Enter a valid phone number').max(20)),
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
  role: z.nativeEnum(Role).refine(isStaffRole, 'Portal users are invited from the client page'),
  departmentId: blankToUndefined(z.string().regex(/^[a-f0-9]{24}$/i)),
  designationId: blankToUndefined(z.string().regex(/^[a-f0-9]{24}$/i)),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords must match', path: ['confirmPassword'] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: 'Choose a different password', path: ['newPassword'] });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
