"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image?: string;
  unitPrice: number;
  stock: number;
  quantity: number;
  variantName?: string;
};

type CartState = {
  items: CartItem[];
  isCartOpen: boolean;
  hasHydrated: boolean;
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeFromCart: (itemKey: string) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export function getCartItemKey(item: Pick<CartItem, "productId" | "variantName">) {
  return `${item.productId}:${item.variantName ?? ""}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isCartOpen: false,
      hasHydrated: false,
      addToCart: (input) =>
        set((state) => {
          if (input.stock < 1) return state;
          const item: CartItem = {
            ...input,
            quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
          };
          const key = getCartItemKey(item);
          const existing = state.items.find((entry) => getCartItemKey(entry) === key);
          const items = existing
            ? state.items.map((entry) =>
                getCartItemKey(entry) === key
                  ? {
                      ...entry,
                      quantity: Math.min(entry.quantity + item.quantity, item.stock),
                    }
                  : entry,
              )
            : [{ ...item, quantity: Math.min(item.quantity, item.stock) }, ...state.items];
          return { items, isCartOpen: true };
        }),
      removeFromCart: (itemKey) =>
        set((state) => ({
          items: state.items.filter((item) => getCartItemKey(item) !== itemKey),
        })),
      updateQuantity: (itemKey, quantity) =>
        set((state) => {
          const nextQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
          return {
            items: state.items.flatMap((item) => {
              if (getCartItemKey(item) !== itemKey) return [item];
              if (nextQuantity < 1 || item.stock < 1) return [];
              return [{ ...item, quantity: Math.min(nextQuantity, item.stock) }];
            }),
          };
        }),
      clearCart: () => set({ items: [] }),
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "idai-store-cart",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
