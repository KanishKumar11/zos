// Single import root layout — wraps theme + query + toast providers and loads the global CSS.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Agency Management Panel',
  description: 'OWNER-only financial isolation, role-based agency operations',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <ToastProvider />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
