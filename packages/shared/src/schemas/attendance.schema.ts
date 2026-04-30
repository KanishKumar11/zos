// Attendance + Leave Zod schemas.
import { z } from 'zod';

import { AttendanceStatus, LeaveType } from '../enums';
import { isoDateSchema, objectIdSchema } from './common.schema';

export const checkInSchema = z.object({
  note: z.string().max(500).optional(),
});
export const checkOutSchema = z.object({
  note: z.string().max(500).optional(),
});

export const adminMarkAttendanceSchema = z.object({
  userId: objectIdSchema,
  date: isoDateSchema,
  status: z.nativeEnum(AttendanceStatus),
  workedMinutes: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
});
export type AdminMarkAttendanceInput = z.infer<typeof adminMarkAttendanceSchema>;

export const myAttendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'expected YYYY-MM'),
});
export type MyAttendanceQuery = z.infer<typeof myAttendanceQuerySchema>;

export const teamAttendanceQuerySchema = z.object({
  date: isoDateSchema,
  departmentId: objectIdSchema.optional(),
});
export type TeamAttendanceQuery = z.infer<typeof teamAttendanceQuerySchema>;

export const requestLeaveSchema = z
  .object({
    type: z.nativeEnum(LeaveType),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    reason: z.string().min(2).max(1000),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });
export type RequestLeaveInput = z.infer<typeof requestLeaveSchema>;

export const decideLeaveSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(1000).optional(),
});
export type DecideLeaveInput = z.infer<typeof decideLeaveSchema>;
