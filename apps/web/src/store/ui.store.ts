// UI store — sidebar state, theme, command palette open state. Persisted to localStorage.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setCommandOpen: (v) => set({ commandOpen: v }),
    }),
    { name: 'agency.ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
