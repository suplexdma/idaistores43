import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { containsFoodRelatedText } from "@/lib/catalog-policy";
import { connectToDatabase } from "@/lib/db";
import Category from "@/models/Category";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentCategory: z
    .union([z.string().regex(/^[a-f\d]{24}$/i), z.null()])
    .optional(),
});

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let input: z.infer<typeof categorySchema>;
  try {
    input = categorySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid request body." },
      { status: 400 },
    );
  }
  if (containsFoodRelatedText(input.name, input.slug)) {
    return NextResponse.json(
      { error: "Food and grocery categories are not supported by this store." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    if (input.parentCategory) {
      const parent = await Category.findById(input.parentCategory)
        .select("parentCategory")
        .lean();
      if (!parent) {
        return NextResponse.json({ error: "Parent category not found." }, { status: 400 });
      }
      if (parent.parentCategory) {
        return NextResponse.json(
          { error: "Categories can only have one parent level." },
          { status: 400 },
        );
      }
    }
    const category = await Category.create(input);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ error: "Category slug already exists." }, { status: 409 });
    }
    console.error("Category creation failed:", error);
    return NextResponse.json({ error: "Unable to create category." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
