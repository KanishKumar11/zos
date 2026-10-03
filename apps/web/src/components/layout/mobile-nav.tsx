// MobileNav — the sidebar as a left drawer below the md breakpoint.
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { useQuickActions } from '@/store/quick-actions.store';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

import { Brand } from './brand';
import { NavList } from './nav-list';

export function MobileNav() {
  const open = useQuickActions((s) => s.mobileNavOpen);
  const setOpen = useQuickActions((s) => s.setMobileNavOpen);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname, setOpen]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[264px] border-r-0 bg-rail text-rail-foreground sm:max-w-[264px] [&>button]:text-rail-foreground/60 [&>button:hover]:bg-rail-foreground/10 [&>button:hover]:text-rail-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-16 items-center px-4">
          <Brand tone="rail" />
        </div>
        <nav className="flex-1 overflow-y-auto p-2 pt-3">
          <NavList tone="rail" onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
