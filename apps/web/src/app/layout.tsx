// Single import root layout — wraps theme + query + toast providers and loads the global CSS.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';

import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';

import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Display face for headlines and hero numbers (variable width + optical size).
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['wdth', 'opsz'],
});

export const metadata: Metadata = {
  title: 'ZOS · Zlaark',
  description: 'Zlaark agency workspace — projects, people, payments and client portal',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}>
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
