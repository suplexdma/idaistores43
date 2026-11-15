"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";

export function CartHydration() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useWishlistStore.persist.rehydrate();
  }, []);

  return null;
}
