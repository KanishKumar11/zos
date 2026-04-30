// Adds a unique x-request-id to each request for log correlation.
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

import { REQUEST_ID_HEADER } from '../constants/app.constants';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const id = incoming && incoming.length > 0 ? incoming : uuid();
    req.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
