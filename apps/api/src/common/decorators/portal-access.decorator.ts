// @PortalAccess() — opts a route (or controller) in for CLIENT portal users. Every other route
// rejects CLIENT users via ClientDenyGuard, so new endpoints are staff-only by default.
import { SetMetadata } from '@nestjs/common';

export const PORTAL_ACCESS_KEY = 'portalAccess';
export const PortalAccess = (): MethodDecorator & ClassDecorator => SetMetadata(PORTAL_ACCESS_KEY, true);
