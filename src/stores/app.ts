// Global app store: tracks the active view, the active project (for the
// project-detail view), and the command-palette / global-search open state.
// TanStack Query handles server state; this store handles UI state.

import { create } from 'zustand';
import type { ViewId } from '@/lib/cyber/types';

interface AppState {
  view: ViewId;
  activeProjectId: string | null;
  commandPaletteOpen: boolean;
  globalSearchOpen: boolean;
  setView: (v: ViewId) => void;
  openProject: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'command-center',
  activeProjectId: null,
  commandPaletteOpen: false,
  globalSearchOpen: false,
  setView: (v) => set({ view: v }),
  openProject: (id) => set({ view: 'project-detail', activeProjectId: id }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
}));
