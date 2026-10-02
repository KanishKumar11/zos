// Client portal route group — separate, lighter shell for client users.
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';

import { PortalShell } from './portal-shell';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
