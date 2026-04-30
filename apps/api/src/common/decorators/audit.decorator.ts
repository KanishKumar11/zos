// @Audit(action) — flags a route to be persisted to the audit log by AuditInterceptor.
import { SetMetadata } from '@nestjs/common';

import type { AuditAction } from '@agency/shared';

export const AUDIT_KEY = 'audit';
export const Audit = (action: AuditAction): MethodDecorator => SetMetadata(AUDIT_KEY, action);
