import { create } from 'zustand';
import type { MenuItem, MenuResponse } from '../types';
import { api } from '../api/client';

type MenuState = {
  data: MenuResponse | null;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  byId: (id: string) => MenuItem | undefined;
};

export const useMenu = create<MenuState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  load: async (force) => {
    if (get().data && !force) return;
    set({ loading: true, error: null });
    try {
      const res = await api.getMenu();
      set({ data: res, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load menu', loading: false });
    }
  },
  byId: (id) => get().data?.items.find((it) => it.id === id),
}));
