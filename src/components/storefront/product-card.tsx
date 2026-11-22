"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Heart, ShoppingBag, Star } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPKR } from "@/components/storefront/cart-drawer";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { cloudinaryImageLoader } from "@/lib/cloudinary-url";

export type StorefrontProduct = {
  _id: string;
  name: string;
  slug: string;
  brand?: string;
  description?: string;
  variants?: { name: string; price?: number; salePrice?: number; stock: number }[];
  price: number;
  compareAtPrice?: number;
  salePrice?: number;
  stock: number;
  images: { url: string; alt?: string }[];
  rating?: { averageRating: number; reviewCount: number };
};

type ProductCardProps = {
  product: StorefrontProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const addToCart = useCartStore((state) => state.addToCart);
  const wishlistItems = useWishlistStore((state) => state.items);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const isWishlisted = wishlistItems.some((item) => item._id === product._id);
  const image = product.images[0];
  const hasCompareAtPrice =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const currentPrice =
    hasCompareAtPrice
      ? product.price
      : product.salePrice != null && product.salePrice < product.price
      ? product.salePrice
      : product.price;
  const availableStock = product.variants?.length
    ? product.variants.reduce((total, variant) => total + variant.stock, 0)
    : product.stock;
  const hasVariants = Boolean(product.variants?.length);

  function addProduct() {
    if (hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }
    addToCart({
      productId: product._id,
      slug: product.slug,
      name: product.name,
      image: image?.url,
      unitPrice: currentPrice,
      stock: availableStock,
    });
  }

  function orderNow() {
    if (availableStock < 1) return;
    if (hasVariants) {
      router.push(`/product/${product.slug}`);
      return;
    }
    addProduct();
    router.push("/checkout");
  }

  return (
    <motion.article
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }}
      className="group min-w-0"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f0f0eb]">
        <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
          {image ? (
            <Image
              src={image.url}
              loader={cloudinaryImageLoader}
              alt={image.alt || product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              IDAI STORES 43
            </div>
          )}
        </Link>
        {(hasCompareAtPrice || (product.salePrice != null && product.salePrice < product.price)) && (
          <span className="absolute left-3 top-3 rounded-full bg-brand-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-charcoal">
            Special price
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={isWishlisted}
          onClick={() => toggleWishlist(product)}
          className="absolute right-3 top-14 size-9 rounded-full bg-white/90 text-brand-charcoal shadow transition hover:bg-white"
        >
          <Heart aria-hidden="true" className={`size-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
        </Button>
        <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`Quick view ${product.name}`}
              className="absolute right-3 top-3 size-9 rounded-full bg-white/90 shadow opacity-100 transition hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              <Eye aria-hidden="true" className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{product.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {image && (
                  <Image
                    src={image.url}
                    loader={cloudinaryImageLoader}
                    alt={image.alt || product.name}
                    fill
                    sizes="(max-width: 640px) 90vw, 40vw"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col items-start">
                {product.brand && (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-olive">
                    {product.brand}
                  </p>
                )}
                <h3 className="mt-2 text-2xl font-semibold">{product.name}</h3>
                <Price price={product.price} compareAtPrice={product.compareAtPrice} salePrice={product.salePrice} className="mt-4 text-xl" />
                <p className="mt-4 line-clamp-5 text-sm leading-6 text-muted-foreground">
                  {product.description || "A thoughtful find, selected with care by IDAI STORES 43."}
                </p>
                <p className="mt-4 text-sm">
                  {availableStock > 0 ? `${availableStock} in stock` : "Currently out of stock"}
                </p>
                <Button
                  type="button"
                  className="mt-auto w-full sm:mt-8"
                  disabled={availableStock < 1}
                  onClick={() => {
                    addProduct();
                    setQuickViewOpen(false);
                  }}
                >
                  <ShoppingBag aria-hidden="true" className="size-4" />
                  {hasVariants ? "Choose options" : "Add to bag"}
                </Button>
                <Link
                  href={`/product/${product.slug}`}
                  onClick={() => setQuickViewOpen(false)}
                  className="mt-3 w-full text-center text-sm font-medium text-brand-olive hover:underline"
                >
                  View full details
                </Link>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="px-0.5 pt-3">
        {product.brand && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {product.brand}
          </p>
        )}
        <Link href={`/product/${product.slug}`} className="mt-1 block">
          <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 transition-colors hover:text-brand-olive">
            {product.name}
          </h3>
        </Link>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} salePrice={product.salePrice} className="mt-2 text-sm" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={availableStock < 1}
            className="min-w-0 border-brand-olive/40 px-1.5 text-[10px] text-brand-charcoal transition-all duration-200 hover:scale-[1.02] hover:bg-brand-olive hover:text-white sm:px-2 sm:text-xs"
            onClick={addProduct}
          >
            <ShoppingBag aria-hidden="true" className="me-1 size-3 shrink-0" />
            <span className="truncate">{availableStock > 0 ? (hasVariants ? "Choose options" : "Add to Cart") : "Out of stock"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={availableStock < 1}
            className="min-w-0 bg-brand-olive px-1.5 text-[10px] text-white transition-all duration-200 hover:scale-[1.02] hover:bg-brand-olive/90 sm:px-2 sm:text-xs"
            onClick={orderNow}
          >
            <span className="truncate">{hasVariants ? "Choose options" : "Order Now"}</span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export function RatingStars({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount: number;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5" aria-label={reviewCount ? `${rating.toFixed(1)} out of 5, ${reviewCount} reviews` : "No reviews yet"}>
      <span className="flex items-center" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={`size-3 ${index < Math.round(rating) ? "fill-brand-gold text-brand-gold" : "text-muted-foreground/30"}`}
          />
        ))}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {reviewCount ? `${rating.toFixed(1)} (${reviewCount})` : "No reviews"}
      </span>
    </div>
  );
}

function Price({
  price,
  compareAtPrice,
  salePrice,
  className = "",
}: {
  price: number;
  compareAtPrice?: number;
  salePrice?: number;
  className?: string;
}) {
  const hasCompareAtPrice = compareAtPrice != null && compareAtPrice > price;
  const isOnLegacySale = salePrice != null && salePrice < price;
  const isOnSale = hasCompareAtPrice || isOnLegacySale;
  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className="font-semibold">{formatPKR(hasCompareAtPrice ? price : isOnLegacySale ? salePrice : price)}</span>
      {isOnSale && (
        <span className="text-xs text-muted-foreground line-through">{formatPKR(hasCompareAtPrice ? compareAtPrice : price)}</span>
      )}
    </div>
  );
}
