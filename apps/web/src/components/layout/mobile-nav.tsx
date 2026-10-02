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
      <SheetContent side="left" className="w-[260px] sm:max-w-[260px]">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <nav className="flex-1 overflow-y-auto p-2 pt-3">
          <NavList onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
