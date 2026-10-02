// Page meta — title + breadcrumbs published by PageHeader, read by the Topbar and document.title.
import { create } from 'zustand';

export interface Crumb {
  label: string;
  href?: string;
}

interface PageMetaState {
  title: string;
  crumbs: Crumb[];
  set: (title: string, crumbs: Crumb[]) => void;
}

export const usePageMetaStore = create<PageMetaState>((set) => ({
  title: '',
  crumbs: [],
  set: (title, crumbs) => set({ title, crumbs }),
}));
