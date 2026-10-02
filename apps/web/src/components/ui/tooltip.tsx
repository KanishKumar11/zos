// Tooltip — small Radix tooltip wrapper. TooltipProvider is mounted once in the app shell.
'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  side = 'top',
  children,
  disabled,
}: {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[70] rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
