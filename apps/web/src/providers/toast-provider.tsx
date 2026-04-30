// Global toaster — Sonner. Attached once at root layout.
'use client';

import { Toaster as Sonner } from 'sonner';

export function ToastProvider() {
  return <Sonner richColors position="top-right" closeButton />;
}
