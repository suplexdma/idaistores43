import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { containsFoodRelatedText } from "@/lib/catalog-policy";
import Category from "@/models/Category";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const categories = (await Category.find()
      .sort({ name: 1 })
      .select("name slug parentCategory")
      .lean()).filter(
        (category) => !containsFoodRelatedText(category.name, category.slug),
      );
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Category listing failed:", error);
    return NextResponse.json({ error: "Unable to load categories." }, { status: 500 });
  }
}
