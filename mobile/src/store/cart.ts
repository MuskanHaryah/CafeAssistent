import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine, SelectedModifier } from '../types';

type CartState = {
  lines: CartLine[];
  hydrated: boolean;
  addLine: (line: Omit<CartLine, 'id'>) => string;
  updateQty: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  setHydrated: (v: boolean) => void;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function modKey(mods: SelectedModifier[]) {
  return mods
    .map((m) => `${m.groupId}:${[...m.optionIds].sort().join(',')}`)
    .sort()
    .join('|');
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      addLine: (incoming) => {
        const key = `${incoming.itemId}::${modKey(incoming.modifiers)}::${incoming.unitPrice}`;
        const existing = get().lines.find(
          (l) => `${l.itemId}::${modKey(l.modifiers)}::${l.unitPrice}` === key,
        );
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.id === existing.id ? { ...l, quantity: l.quantity + incoming.quantity } : l,
            ),
          });
          return existing.id;
        }
        const id = uid();
        set({ lines: [...get().lines, { ...incoming, id }] });
        return id;
      },
      updateQty: (lineId, quantity) => {
        if (quantity <= 0) {
          set({ lines: get().lines.filter((l) => l.id !== lineId) });
          return;
        }
        set({
          lines: get().lines.map((l) => (l.id === lineId ? { ...l, quantity } : l)),
        });
      },
      removeLine: (lineId) =>
        set({ lines: get().lines.filter((l) => l.id !== lineId) }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'cafe-cart-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lines: s.lines }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
}
