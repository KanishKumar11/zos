// Server component — forces all (app) routes to be dynamic (no SSG), then renders the client shell.
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
