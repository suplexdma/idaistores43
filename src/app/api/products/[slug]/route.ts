import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import Product from "@/models/Product";
import Review from "@/models/Review";
import { Types } from "mongoose";

type RouteContext = { params: { slug: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await connectToDatabase();
    const product = await Product.findOne({
      slug: params.slug.toLowerCase(),
      status: "active",
    })
      .select("-costPrice")
      .populate("category", "name slug")
      .lean();
    if (!product || !isAllowedNonFoodProduct(product)) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const rating = await Review.aggregate<{
      averageRating: number;
      reviewCount: number;
    }>([
      { $match: { productId: new Types.ObjectId(product._id), status: "Approved" } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]);
    return NextResponse.json({
      product,
      rating: rating[0] ?? { averageRating: 0, reviewCount: 0 },
    });
  } catch (error) {
    console.error("Product detail lookup failed:", error);
    return NextResponse.json({ error: "Unable to load product." }, { status: 500 });
  }
}
