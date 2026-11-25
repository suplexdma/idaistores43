import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails, type ProductDetailData } from "@/components/storefront/product-details";
import type { ApprovedReview } from "@/components/storefront/product-reviews";
import { isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import { connectToDatabase } from "@/lib/db";
import Category from "@/models/Category";
import Product, { type Product as ProductSchema } from "@/models/Product";
import Review from "@/models/Review";
import { productRichTextToPlainText, sanitizeProductRichText } from "@/lib/product-rich-text";

export const dynamic = "force-dynamic";

type ProductRouteProps = { params: { slug: string } };

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  await connectToDatabase();
  const product = await Product.findOne({ slug: params.slug.toLowerCase(), status: "active" })
    .select("name shortDescription description category slug images brand")
    .lean();
  if (!product) return { title: "Product not found" };
  const category = await Category.findById(product.category).select("name slug").lean();
  if (!isAllowedNonFoodProduct({ ...product, category })) return { title: "Product not found" };
  const description =
    productRichTextToPlainText(product.shortDescription || product.description || "") ||
    `Discover ${product.name} at IDAI STORES 43.`;
  const image = product.images[0]?.url ?? "/images/category-home-decor.jpg";
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${encodeURIComponent(product.slug)}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/product/${encodeURIComponent(product.slug)}`,
      images: [{ url: image, alt: product.images[0]?.alt ?? product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [image],
    },
  };
}

export default async function ProductRoute({ params }: ProductRouteProps) {
  await connectToDatabase();
  const product = await Product.findOne({
    slug: params.slug.toLowerCase(),
    status: "active",
  }).lean();
  if (!product) notFound();

  const category = await Category.findById(product.category).select("name slug").lean();
  if (!isAllowedNonFoodProduct({ ...product, category })) notFound();

  const [relatedProducts, ratings, reviews] = await Promise.all([
    Product.find({
      category: product.category,
      status: "active",
      _id: { $ne: product._id },
    })
      .sort({ createdAt: -1 })
      .limit(16)
      .select("name slug price salePrice stock variants images brand")
      .lean(),
    Review.aggregate<{ averageRating: number; reviewCount: number }>([
      { $match: { productId: product._id, status: "Approved" } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]),
    Review.find({ productId: product._id, status: "Approved" })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("rating comment userId createdAt")
      .populate("userId", "name")
      .lean(),
  ]);

  const detail: ProductDetailData = {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    description: sanitizeProductRichText(product.description ?? ""),
    shortDescription: sanitizeProductRichText(product.shortDescription ?? ""),
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    salePrice: product.salePrice,
    stock: product.stock,
    weight: product.weight,
    dimensions: product.dimensions,
    categoryName: category?.name ?? "",
    images: product.images.map((image: ProductSchema["images"][number]) => ({
      url: image.url,
      alt: image.alt ?? product.name,
    })),
    specs: product.specs.map((spec: ProductSchema["specs"][number]) => ({
      name: spec.name,
      value: spec.value,
    })),
    variants: product.variants.map((variant: ProductSchema["variants"][number]) => ({
      name: variant.name,
      price: variant.price,
      salePrice: variant.salePrice,
      stock: variant.stock,
      image: variant.image
        ? { url: variant.image.url, alt: variant.image.alt ?? `${product.name} ${variant.name}` }
        : undefined,
    })),
    rating: ratings[0] ?? { averageRating: 0, reviewCount: 0 },
    reviews: reviews.map((review): ApprovedReview => ({
      id: review._id.toString(),
      reviewer:
        review.userId && typeof review.userId === "object" && "name" in review.userId
          ? String(review.userId.name || "Customer")
          : "Customer",
      rating: review.rating,
      comment: review.comment ?? "",
      createdAt: new Date(review.createdAt).toISOString(),
    })),
  };
  const related: ProductDetailData["relatedProducts"] = relatedProducts
    .filter((item) => isAllowedNonFoodProduct({ ...item, category }))
    .slice(0, 4)
    .map((item) => ({
    _id: item._id.toString(),
    name: item.name,
    slug: item.slug,
    brand: item.brand,
    price: item.price,
    compareAtPrice: item.compareAtPrice,
    salePrice: item.salePrice,
    stock: item.stock,
    variants: item.variants.map((variant: ProductSchema["variants"][number]) => ({
      name: variant.name,
      price: variant.price,
      salePrice: variant.salePrice,
      stock: variant.stock,
    })),
    images: item.images.map((image: ProductSchema["images"][number]) => ({
      url: image.url,
      alt: image.alt ?? item.name,
    })),
    }));

  const siteUrl = (process.env.NEXTAUTH_URL ?? "https://idai-stores-43.onrender.com").replace(/\/$/, "");
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productRichTextToPlainText(product.description ?? ""),
    image: product.images.map((image: ProductSchema["images"][number]) => image.url),
    sku: product._id.toString(),
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    ...(detail.rating.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: detail.rating.averageRating,
            reviewCount: detail.rating.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
      priceCurrency: "PKR",
      price: product.salePrice ?? product.price,
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${siteUrl}/shop` },
      ...(category
        ? [{
            "@type": "ListItem",
            position: 3,
            name: category.name,
            item: `${siteUrl}/shop?category=${encodeURIComponent(product.category.toString())}`,
          }]
        : []),
      {
        "@type": "ListItem",
        position: category ? 4 : 3,
        name: product.name,
        item: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
      },
    ],
  };
  const safeJsonLd = (value: object) =>
    JSON.stringify(value).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <ProductDetails product={{ ...detail, relatedProducts: related }} />
    </>
  );
}
