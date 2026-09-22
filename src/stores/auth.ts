// Auth store — tracks current user, role, login/logout state.
// Used by the UI to:
// - show LoginView when unauthenticated
// - show user name + role + logout button in TopBar
// - hide navigation/actions based on role

import { create } from 'zustand';

export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  authDisabled: boolean;
  loading: boolean;       // initial session check in flight
  error: string | null;
  setUser: (user: AuthUser | null, authDisabled?: boolean) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authDisabled: false,
  loading: true,
  error: null,
  setUser: (user, authDisabled) => set((s) => ({ user, authDisabled: authDisabled ?? s.authDisabled, loading: false, error: null })),
  setLoading: (b) => set({ loading: b }),
  setError: (e) => set({ error: e, loading: false }),
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    set({ user: null, authDisabled: false, loading: false, error: null });
  },
  refresh: async () => {
    set({ loading: true });
    try {
      const r = await fetch('/api/auth/session');
      if (r.status === 401) {
        set({ user: null, authDisabled: false, loading: false, error: null });
        return;
      }
      const j = await r.json();
      if (j.ok && j.data?.user) {
        set({ user: j.data.user, authDisabled: j.data.authDisabled ?? false, loading: false, error: null });
      } else {
        set({ user: null, authDisabled: false, loading: false, error: null });
      }
    } catch (e) {
      set({ user: null, loading: false, error: (e as Error).message });
    }
  },
}));

// Role-permission matrix mirrored from src/lib/cyber/auth.ts (server-side)
// Used for client-side UI gating ONLY — server enforces authoritatively.
export type Action = 'read' | 'create' | 'update' | 'delete' | 'run' | 'stop' | 'scan' | 'admin';

const ROLE_PERMISSIONS: Record<Role, Set<Action>> = {
  ADMIN: new Set<Action>(['read', 'create', 'update', 'delete', 'run', 'stop', 'scan', 'admin']),
  OPERATOR: new Set<Action>(['read', 'create', 'update', 'run', 'stop', 'scan']),
  VIEWER: new Set<Action>(['read']),
};

export function canClient(user: AuthUser | null, action: Action): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].has(action);
}
