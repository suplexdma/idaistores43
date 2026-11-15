import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { ShopPage } from "@/components/storefront/shop-page";
import { connectToDatabase } from "@/lib/db";
import { containsFoodRelatedText } from "@/lib/catalog-policy";
import Category from "@/models/Category";

type ShopRouteProps = {
  searchParams: { category?: string | string[] };
};

export async function generateMetadata({ searchParams }: ShopRouteProps): Promise<Metadata> {
  const categoryId = Array.isArray(searchParams.category)
    ? searchParams.category[0]
    : searchParams.category;
  if (!categoryId || !isValidObjectId(categoryId)) {
    return {
      title: "Shop",
      description: "Explore thoughtfully selected non-food products at IDAI STORES 43.",
      alternates: { canonical: "/shop" },
    };
  }

  await connectToDatabase();
  const category = await Category.findById(categoryId).select("name slug").lean();
  if (!category || containsFoodRelatedText(category.name, category.slug)) {
    return {
      title: "Shop",
      description: "Explore thoughtfully selected non-food products at IDAI STORES 43.",
      alternates: { canonical: "/shop" },
    };
  }

  const title = `${category.name} collection`;
  const description = `Explore the ${category.name} collection at IDAI STORES 43. Thoughtfully selected finds with Cash on Delivery across Pakistan.`;
  const canonical = `/shop?category=${encodeURIComponent(category._id.toString())}`;
  const imageByCategory: Record<string, string> = {
    stationery: "/images/category-stationery.jpg",
    toys: "/images/category-toys.jpg",
    gifts: "/images/category-gifts.jpg",
    kitchenware: "/images/category-kitchenware.jpg",
    "beauty-personal-care": "/images/category-beauty.jpg",
    "household-items": "/images/category-household.jpg",
    "baby-care": "/images/category-baby-care.jpg",
    "home-decor": "/images/category-home-decor.jpg",
    "plastic-items": "/images/category-plastic-items.jpg",
    bags: "/images/category-bags.jpg",
    "water-bottles": "/images/category-water-bottles.jpg",
    "lunch-boxes-storage": "/images/category-lunchboxes.svg",
  };
  const image = imageByCategory[category.slug] ?? "/images/category-home-decor.jpg";
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: [{ url: image, alt: `${category.name} at IDAI STORES 43` }],
    },
  };
}

export default function ShopRoute() {
  return <ShopPage />;
}
