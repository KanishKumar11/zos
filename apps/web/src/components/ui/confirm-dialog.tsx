// Confirm dialog — promise-based replacement for window.confirm().
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Delete invoice?', destructive: true })) remove.mutate(id);
'use client';

import { create } from 'zustand';

import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve?: (ok: boolean) => void;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  settle: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: { title: '' },
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false);
      set({ open: true, options, resolve });
    }),
  settle: (ok) => {
    get().resolve?.(ok);
    set({ open: false, resolve: undefined });
  },
}));

export const useConfirm = () => useConfirmStore((s) => s.ask);

/** Mount once near the root. */
export function ConfirmHost() {
  const { open, options, settle } = useConfirmStore();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {options.cancelText ?? 'Cancel'}
          </Button>
          <Button
            autoFocus
            variant={options.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
          >
            {options.confirmText ?? (options.destructive ? 'Delete' : 'Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
