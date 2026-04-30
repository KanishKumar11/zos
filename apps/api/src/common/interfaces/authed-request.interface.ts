// Express Request augmented with the authenticated user payload.
import type { Request } from 'express';

import type { JwtPayload } from './jwt-payload.interface';

export interface AuthedRequest extends Request {
  user: JwtPayload;
  requestId?: string;
}
