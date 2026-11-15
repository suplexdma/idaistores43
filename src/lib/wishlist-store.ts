"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WishlistItem = {
  _id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number;
  stock: number;
  images: { url: string; alt?: string }[];
};

type WishlistState = {
  items: WishlistItem[];
  hydrated: boolean;
  toggle: (item: WishlistItem) => void;
  remove: (id: string) => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,
      toggle: (item) =>
        set((state) => ({
          items: state.items.some((entry) => entry._id === item._id)
            ? state.items.filter((entry) => entry._id !== item._id)
            : [item, ...state.items],
        })),
      remove: (id) => set((state) => ({ items: state.items.filter((item) => item._id !== id) })),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "idai-store-wishlist",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
