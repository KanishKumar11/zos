import { Role } from '@agency/shared';

import { canAccessStoragePath } from './storage.controller';

describe('canAccessStoragePath', () => {
  const me = 'user000000000000000000aa';

  it('lets the owner read any area', () => {
    expect(canAccessStoragePath('expenses/receipts/a.pdf', { sub: 'o', role: Role.OWNER })).toBe(true);
  });

  it('lets admins into staff documents only', () => {
    const admin = { sub: 'a', role: Role.ADMIN };
    expect(canAccessStoragePath(`users/${me}/documents/x.pdf`, admin)).toBe(true);
    expect(canAccessStoragePath('expenses/receipts/a.pdf', admin)).toBe(false);
  });

  it('limits everyone else to their own folder', () => {
    const member = { sub: me, role: Role.MEMBER };
    expect(canAccessStoragePath(`users/${me}/documents/x.pdf`, member)).toBe(true);
    expect(canAccessStoragePath('users/someone-else/documents/x.pdf', member)).toBe(false);
    expect(canAccessStoragePath('expenses/receipts/a.pdf', member)).toBe(false);
    expect(canAccessStoragePath('sows/123/signed.pdf', { sub: me, role: Role.CLIENT })).toBe(false);
  });

  it('rejects path traversal', () => {
    expect(canAccessStoragePath(`users/${me}/../other/x.pdf`, { sub: me, role: Role.MEMBER })).toBe(false);
  });
});
