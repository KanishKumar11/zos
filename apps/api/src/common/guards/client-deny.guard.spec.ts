import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '@agency/shared';

import { PortalAccess } from '../decorators/portal-access.decorator';
import { ClientDenyGuard } from './client-deny.guard';

class StaffController {
  list() {}
}

@PortalAccess()
class PortalController {
  list() {}
}

class MixedController {
  staffOnly() {}
  @PortalAccess()
  shared() {}
}

const ctx = (role: Role | undefined, cls: new () => object, handler: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { sub: 'u1', role } : undefined }) }),
    getClass: () => cls,
    getHandler: () => (cls.prototype as Record<string, unknown>)[handler],
  }) as unknown as ExecutionContext;

describe('ClientDenyGuard', () => {
  const guard = new ClientDenyGuard(new Reflector());

  it('lets staff through everywhere', () => {
    for (const role of [Role.OWNER, Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN]) {
      expect(guard.canActivate(ctx(role, StaffController, 'list'))).toBe(true);
    }
  });

  it('lets unauthenticated (public) routes through', () => {
    expect(guard.canActivate(ctx(undefined, StaffController, 'list'))).toBe(true);
  });

  it('blocks clients from routes without @PortalAccess', () => {
    expect(() => guard.canActivate(ctx(Role.CLIENT, StaffController, 'list'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(Role.CLIENT, MixedController, 'staffOnly'))).toThrow(ForbiddenException);
  });

  it('allows clients on portal controllers and portal handlers', () => {
    expect(guard.canActivate(ctx(Role.CLIENT, PortalController, 'list'))).toBe(true);
    expect(guard.canActivate(ctx(Role.CLIENT, MixedController, 'shared'))).toBe(true);
  });
});
