import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Review from "@/models/Review";

const reviewUpdateSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
  status: z.enum(["Approved", "Rejected"]),
});

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    await connectToDatabase();
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .select("rating comment status createdAt productId userId")
      .populate("productId", "name slug")
      .populate("userId", "name email")
      .lean();
    return NextResponse.json({
      reviews: reviews.map((review) => ({
        id: review._id.toString(),
        rating: review.rating,
        comment: review.comment ?? "",
        status: review.status,
        createdAt: review.createdAt,
        product:
          review.productId && typeof review.productId === "object" && "name" in review.productId
            ? {
                name: String(review.productId.name),
                slug: String("slug" in review.productId ? review.productId.slug : ""),
              }
            : { name: "Deleted product", slug: "" },
        customer:
          review.userId && typeof review.userId === "object" && "name" in review.userId
            ? {
                name: String(review.userId.name || "Customer"),
                email: String("email" in review.userId ? review.userId.email ?? "" : ""),
              }
            : { name: "Deleted customer", email: "" },
      })),
    });
  } catch (error) {
    console.error("Admin review listing failed:", error);
    return NextResponse.json({ error: "Unable to load reviews." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  let input: z.infer<typeof reviewUpdateSchema>;
  try {
    input = reviewUpdateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid review update." },
      { status: 400 },
    );
  }
  try {
    await connectToDatabase();
    const review = await Review.findByIdAndUpdate(
      input.id,
      { $set: { status: input.status } },
      { new: true, runValidators: true },
    )
      .select("status")
      .lean();
    if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ id: input.id, status: review.status });
  } catch (error) {
    console.error("Admin review update failed:", error);
    return NextResponse.json({ error: "Unable to update review." }, { status: 500 });
  }
}
