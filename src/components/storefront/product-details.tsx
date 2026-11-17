"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ProductCard, RatingStars, type StorefrontProduct } from "@/components/storefront/product-card";
import { cloudinaryImageLoader } from "@/lib/cloudinary-url";
import {
  formatPKR,
  FREE_DELIVERY_THRESHOLD,
  STANDARD_DELIVERY_CHARGE,
} from "@/components/storefront/cart-drawer";
import { useCartStore } from "@/lib/cart-store";
import { ProductReviews, type ApprovedReview } from "@/components/storefront/product-reviews";

type ProductDetailVariant = {
  name: string;
  price?: number;
  salePrice?: number;
  stock: number;
  image?: { url: string; alt: string };
};

export type ProductDetailData = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  salePrice?: number;
  stock: number;
  categoryName: string;
  images: { url: string; alt: string }[];
  specs: { name: string; value: string }[];
  variants: ProductDetailVariant[];
  rating: { averageRating: number; reviewCount: number };
  reviews: ApprovedReview[];
  relatedProducts?: StorefrontProduct[];
};

export function ProductDetails({ product }: { product: ProductDetailData }) {
  const router = useRouter();
  const addToCart = useCartStore((state) => state.addToCart);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "details">("description");
  const [zoom, setZoom] = useState(1);
  const selectedVariant = product.variants.find((variant) => variant.name === selectedVariantName);
  const availableStock = selectedVariant?.stock ?? (
    product.variants.length
      ? product.variants.reduce((total, variant) => total + variant.stock, 0)
      : product.stock
  );
  const price = selectedVariant?.price ?? product.price;
  const compareAtPrice = selectedVariant ? undefined : product.compareAtPrice;
  const salePrice = selectedVariant?.salePrice ?? product.salePrice;
  const hasCompareAtPrice = compareAtPrice != null && compareAtPrice > price;
  const currentPrice = hasCompareAtPrice ? price : salePrice != null && salePrice < price ? salePrice : price;
  const selectedImage = selectedVariant?.image ?? product.images[activeImage];

  function addProduct(buyNow = false) {
    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: selectedImage?.url,
      unitPrice: currentPrice,
      stock: availableStock,
      quantity,
      variantName: selectedVariant?.name,
    });
    if (buyNow) router.push("/cart");
  }

  function changeImage(direction: -1 | 1) {
    if (!product.images.length) return;
    setActiveImage((current) => (current + direction + product.images.length) % product.images.length);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-brand-olive">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:text-brand-olive">Shop</Link>
        {product.categoryName && <><span className="mx-2">/</span><span>{product.categoryName}</span></>}
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row">
            {product.images.length > 1 && (
              <div className="order-2 flex gap-3 overflow-x-auto pb-2 sm:order-1 sm:max-h-[min(42rem,80vw)] sm:w-20 sm:shrink-0 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:pb-0">
                {product.images.map((image, index) => (
                  <button
                    type="button"
                    key={`${image.url}-${index}`}
                    onClick={() => setActiveImage(index)}
                    aria-label={`Show product image ${index + 1}`}
                    aria-pressed={activeImage === index}
                    className={`relative size-20 shrink-0 overflow-hidden rounded-md border-2 ${activeImage === index ? "border-brand-olive" : "border-transparent"}`}
                  >
                    <Image src={image.url} loader={cloudinaryImageLoader} alt={image.alt || product.name} fill sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="order-1 min-w-0 flex-1 sm:order-2">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-[#f0f0eb] text-left"
                    aria-label="Open product image zoom"
                  >
                    {selectedImage ? (
                      <Image
                        src={selectedImage.url}
                        loader={cloudinaryImageLoader}
                        alt={selectedImage.alt || product.name}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">No image available</div>
                    )}
                    <span className="absolute bottom-4 right-4 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-brand-charcoal shadow opacity-100 transition group-hover:bg-white">
                      <ZoomIn aria-hidden="true" className="size-4" />
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
                  <DialogTitle className="sr-only">{product.name} image preview</DialogTitle>
                  <div className="relative aspect-square max-h-[85vh] w-full overflow-hidden rounded-xl bg-white">
                    {selectedImage && (
                      <Image
                        src={selectedImage.url}
                        loader={cloudinaryImageLoader}
                        alt={selectedImage.alt || product.name}
                        fill
                        sizes="90vw"
                        style={{ transform: `scale(${zoom})` }}
                        className="object-contain transition-transform duration-200"
                      />
                    )}
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <Button type="button" variant="secondary" size="icon" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}>
                        <ZoomOut aria-hidden="true" className="size-4" />
                      </Button>
                      <Button type="button" variant="secondary" size="icon" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}>
                        <ZoomIn aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {product.images.length > 1 && (
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outline" size="icon" aria-label="Previous image" onClick={() => changeImage(-1)}>
                    <ChevronLeft aria-hidden="true" className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Next image" onClick={() => changeImage(1)}>
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:py-4">
          {product.brand && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">{product.brand}</p>
          )}
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{product.name}</h1>
          {product.shortDescription && (
            <div
              className="product-rich-text mt-3 max-w-xl text-sm leading-6 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: product.shortDescription }}
            />
          )}
          <RatingStars rating={product.rating.averageRating} reviewCount={product.rating.reviewCount} />
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatPKR(currentPrice)}</span>
            {hasCompareAtPrice || (salePrice != null && salePrice < price) ? (
              <span className="text-base text-muted-foreground line-through">{formatPKR(hasCompareAtPrice ? compareAtPrice : price)}</span>
            ) : null}
          </div>
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${availableStock > 0 ? "bg-brand-olive/10 text-brand-olive" : "bg-destructive/10 text-destructive"}`}>
            {availableStock > 0 ? <><Check aria-hidden="true" className="size-3.5" /> In stock</> : "Out of stock"}
          </div>
          {product.variants.length > 0 && (
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Choose an option</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.name}
                    type="button"
                    disabled={variant.stock < 1}
                    aria-pressed={selectedVariantName === variant.name}
                    onClick={() => {
                      setSelectedVariantName(variant.name);
                      setQuantity(1);
                    }}
                    className={`rounded-md border px-4 py-2 text-sm transition ${selectedVariantName === variant.name ? "border-brand-olive bg-brand-olive/10 text-brand-olive" : "border-border hover:border-brand-olive"} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {product.variants.length > 0 && !selectedVariant && (
            <p className="mt-2 text-sm text-muted-foreground">Select an option to see availability and add this item.</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-md border">
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-r-none"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus aria-hidden="true" className="size-4" />
              </Button>
              <span className="min-w-10 text-center text-sm" aria-live="polite">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-l-none"
                aria-label="Increase quantity"
                disabled={quantity >= availableStock}
                onClick={() => setQuantity((value) => Math.min(availableStock, value + 1))}
              >
                <Plus aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <Button
              size="lg"
              className="min-w-40 flex-1 sm:flex-none"
              disabled={availableStock < 1 || (product.variants.length > 0 && !selectedVariant)}
              onClick={() => addProduct()}
            >
              <ShoppingBag aria-hidden="true" className="size-4" /> Add to bag
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-w-40 flex-1 border-brand-olive text-brand-olive hover:bg-brand-olive hover:text-white sm:flex-none"
              disabled={availableStock < 1 || (product.variants.length > 0 && !selectedVariant)}
              onClick={() => addProduct(true)}
            >
              Buy now
            </Button>
          </div>

          <Card className="mt-7 bg-[#f8f8f4]">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <Truck aria-hidden="true" className="mt-0.5 size-4 text-brand-olive" />
                <p className="text-sm">
                  <span className="font-medium">Delivery:</span> PKR {STANDARD_DELIVERY_CHARGE} under PKR {FREE_DELIVERY_THRESHOLD.toLocaleString()}, free above.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 text-brand-olive" />
                <p className="text-sm">Cash on Delivery available. Your total is confirmed at checkout.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="mt-16 border-t border-border pt-8 sm:mt-20">
        <div role="tablist" aria-label="Product information" className="flex gap-6 border-b border-border">
          <button
            role="tab"
            aria-selected={activeTab === "description"}
            className={`pb-3 text-sm font-medium ${activeTab === "description" ? "border-b-2 border-brand-olive text-brand-olive" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("description")}
          >
            Description
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "details"}
            className={`pb-3 text-sm font-medium ${activeTab === "details" ? "border-b-2 border-brand-olive text-brand-olive" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("details")}
          >
            Product details
          </button>
        </div>
        <div role="tabpanel" className="max-w-3xl py-6 text-sm leading-7 text-muted-foreground">
          {activeTab === "description" ? (
            product.description ? (
              <div className="product-rich-text" dangerouslySetInnerHTML={{ __html: product.description }} />
            ) : "A thoughtful find, selected with care by IDAI STORES 43."
          ) : product.specs.length ? (
            <dl className="divide-y divide-border">
              {product.specs.map((spec) => (
                <div key={spec.name} className="grid grid-cols-2 gap-4 py-3">
                  <dt className="font-medium text-foreground">{spec.name}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            "Product specifications will be added soon."
          )}
        </div>
      </section>

      {!!product.relatedProducts?.length && (
        <section className="mt-10 border-t border-border pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Keep exploring</p>
          <h2 className="mt-2 text-2xl font-semibold">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-5">
            {product.relatedProducts.map((related) => <ProductCard key={related._id} product={related} />)}
          </div>
        </section>
      )}
      <ProductReviews slug={product.slug} reviews={product.reviews} />
    </div>
  );
}
