import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import { connectToDatabase } from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";

type RouteContext = { params: { slug: string } };

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000)
    .transform((value) => value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " "))
    .pipe(z.string().trim().min(5).max(2000)),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user.id) {
    return NextResponse.json({ error: "Sign in to write a review." }, { status: 401 });
  }

  let input: z.infer<typeof reviewSchema>;
  try {
    input = reviewSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid review." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const product = await Product.findOne({
      slug: params.slug.toLowerCase(),
      status: "active",
    })
      .select("name brand shortDescription description")
      .populate("category", "name slug")
      .lean();
    if (!product || !isAllowedNonFoodProduct(product)) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    await Review.create({
      productId: product._id,
      userId: authSession.user.id,
      rating: input.rating,
      comment: input.comment,
      status: "Pending",
    });
    return NextResponse.json(
      { message: "Thanks for your review. It will appear after moderation." },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "You have already reviewed this product." },
        { status: 409 },
      );
    }
    console.error("Product review submission failed:", error);
    return NextResponse.json({ error: "Unable to submit your review." }, { status: 500 });
  }
}
