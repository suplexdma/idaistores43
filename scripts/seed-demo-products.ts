import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import Category from "../src/models/Category";
import Product from "../src/models/Product";

loadEnvConfig(process.cwd());

const demoProducts = [
  {
    name: "Everyday Canvas Tote",
    slug: "demo-everyday-canvas-tote",
    categorySlug: "bags",
    categoryName: "Bags",
    price: 1450,
    image: "category-bags-general.jpg",
    description: "A lightweight everyday tote bag with a roomy, practical design.",
  },
  {
    name: "Desk Organizer Set",
    slug: "demo-desk-organizer-set",
    categorySlug: "household-organizers",
    categoryName: "Household & Organizers",
    price: 1150,
    image: "category-household-general.jpg",
    description: "A useful organizer set to keep stationery and desk essentials in order.",
  },
  {
    name: "Kitchen Utensil Set",
    slug: "demo-kitchen-utensil-set",
    categorySlug: "kitchen-items",
    categoryName: "Kitchen Items",
    price: 1850,
    image: "category-kitchen-general.jpg",
    description: "A coordinated set of everyday kitchen utensils and accessories.",
  },
  {
    name: "Personal Care Travel Kit",
    slug: "demo-personal-care-travel-kit",
    categorySlug: "beauty-personal-care",
    categoryName: "Beauty & Personal Care",
    price: 990,
    image: "category-beauty-general.jpg",
    description: "A compact, non-food personal care kit for everyday routines and travel.",
  },
] as const;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must be configured.");

  const databaseUrl = new URL(uri);
  const isLocalDatabase =
    databaseUrl.hostname === "localhost" ||
    databaseUrl.hostname === "127.0.0.1" ||
    databaseUrl.hostname === "::1";
  if (!isLocalDatabase && process.env.ALLOW_REMOTE_DEMO_SEED !== "YES") {
    throw new Error(
      "Demo seeding is restricted to local MongoDB. Set ALLOW_REMOTE_DEMO_SEED=YES only if you explicitly intend to modify a remote database.",
    );
  }

  await connectToDatabase();
  let createdProducts = 0;
  for (const product of demoProducts) {
    const category = await Category.findOneAndUpdate(
      { slug: product.categorySlug },
      { $setOnInsert: { name: product.categoryName, slug: product.categorySlug } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (await Product.exists({ slug: product.slug })) continue;

    await Product.create({
      name: product.name,
      slug: product.slug,
      brand: "IDAI Demo",
      category: category._id,
      description: product.description,
      price: product.price,
      stock: 12,
      images: [{ url: `/images/${product.image}`, alt: product.name }],
      status: "active",
    });
    createdProducts += 1;
  }
  console.log(`Created ${createdProducts} demo product(s).`);
}

main()
  .catch((error: unknown) => {
    console.error("Demo product seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
