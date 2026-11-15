import type { MetadataRoute } from "next";
import { connectToDatabase } from "@/lib/db";
import { containsFoodRelatedText, isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import Category from "@/models/Category";
import Product from "@/models/Product";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXTAUTH_URL ?? "https://idai-stores-43.onrender.com").replace(/\/$/, "");
  await connectToDatabase();

  const [categories, products, posts] = await Promise.all([
    Category.find({}).select("name slug updatedAt").lean(),
    Product.find({ status: "active" })
      .select("name brand description slug updatedAt category")
      .populate("category", "name slug")
      .lean(),
    Post.find({ status: "Published", deletedAt: null }).select("slug updatedAt").lean(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/blog`, changeFrequency: "weekly", priority: 0.7 },
  ];
  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((category) => !containsFoodRelatedText(category.name, category.slug))
    .map((category) => ({
      url: `${siteUrl}/shop?category=${encodeURIComponent(category._id.toString())}`,
      lastModified: category.updatedAt ?? undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  const productPages: MetadataRoute.Sitemap = products
    .filter((product) => isAllowedNonFoodProduct({ ...product, category: product.category }))
    .map((product) => ({
      url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt ?? undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/blog/${encodeURIComponent(post.slug)}`,
    lastModified: post.updatedAt ?? undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...productPages, ...postPages];
}
