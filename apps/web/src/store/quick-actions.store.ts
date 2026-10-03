// Global quick actions — opened from the "+ New" menu, the ⌘K palette, or any page.
// Drawers that live in the app shell (e.g. Log payment) read their open state from here.
import { create } from 'zustand';

export interface LogPaymentPrefill {
  payeeType?: 'MEMBER' | 'FREELANCER';
  userId?: string;
  freelancerId?: string;
  projectId?: string;
  amountPaise?: number;
  /** A PayoutCategory value, e.g. 'STIPEND'. */
  category?: string;
  note?: string;
}

interface QuickActionsState {
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  logPayment: { open: boolean; prefill: LogPaymentPrefill; editId?: string };
  openLogPayment: (prefill?: LogPaymentPrefill, editId?: string) => void;
  closeLogPayment: () => void;
}

export const useQuickActions = create<QuickActionsState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
  logPayment: { open: false, prefill: {} },
  openLogPayment: (prefill = {}, editId) => set({ logPayment: { open: true, prefill, editId }, paletteOpen: false }),
  closeLogPayment: () => set((s) => ({ logPayment: { ...s.logPayment, open: false } })),
}));
