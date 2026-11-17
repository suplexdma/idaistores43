import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import { connectToDatabase } from "@/lib/db";
import { productInputSchema } from "@/lib/product-validation";
import { containsFoodRelatedText } from "@/lib/catalog-policy";
import { productRichTextLength, sanitizeProductRichText } from "@/lib/product-rich-text";
import Category from "@/models/Category";
import Product, { type Product as ProductSchema } from "@/models/Product";
import InventoryLog from "@/models/InventoryLog";
import { isDuplicateKeyError, validationErrorResponse } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(["SuperAdmin", "Manager"]);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let input;
  try {
    input = productInputSchema.parse(await request.json());
    if (
      (input.shortDescription && productRichTextLength(input.shortDescription) > 300) ||
      (input.description && productRichTextLength(input.description) > 10000)
    ) {
      return NextResponse.json({ error: "Descriptions exceed their allowed character limits." }, { status: 400 });
    }
    if (input.shortDescription) input.shortDescription = sanitizeProductRichText(input.shortDescription);
    if (input.description) input.description = sanitizeProductRichText(input.description);
  } catch (error) {
    return validationErrorResponse(error);
  }

  try {
    const db = await connectToDatabase();
    const categoryIds = input.categories?.length
      ? input.categories
      : input.category
        ? [input.category]
        : [];
    if (categoryIds.length === 0) {
      return NextResponse.json({ error: "Choose at least one category." }, { status: 400 });
    }
    const categories = await Category.find({ _id: { $in: categoryIds } })
      .select("name slug")
      .lean();
    if (categories.length !== new Set(categoryIds).size) {
      return NextResponse.json({ error: "One or more categories were not found." }, { status: 400 });
    }
    if (
      categories.some((category) => containsFoodRelatedText(category.name, category.slug)) ||
      !isAllowedNonFoodProduct({
        ...input,
        category: categories.map((category) => `${category.name} ${category.slug}`).join(" "),
      })
    ) {
      return NextResponse.json(
        { error: "Food and grocery products are not supported by this store." },
        { status: 400 },
      );
    }

    const session = await db.startSession();
    let product: Awaited<ReturnType<typeof Product.create>>[number] | null = null;
    try {
      await session.withTransaction(async () => {
        const [createdProduct] = await Product.create(
          [{
            ...input,
            category: categoryIds[0],
            categories: categoryIds,
            status: input.status ?? "active",
          }],
          { session },
        );
        const movements = createdProduct.variants.length
          ? createdProduct.variants.filter((variant: ProductSchema["variants"][number]) => variant.stock > 0).map((variant: ProductSchema["variants"][number]) => ({
              productId: createdProduct._id,
              variantName: variant.name,
              quantityChanged: variant.stock,
              remainingStock: variant.stock,
              reason: "Initial product stock",
              source: "Manual" as const,
              adminId: admin.sub,
            }))
          : createdProduct.stock > 0
            ? [{
                productId: createdProduct._id,
                quantityChanged: createdProduct.stock,
                remainingStock: createdProduct.stock,
                reason: "Initial product stock",
                source: "Manual" as const,
                adminId: admin.sub,
              }]
            : [];
        if (movements.length) await InventoryLog.create(movements, { session });
        product = createdProduct;
      });
    } finally {
      await session.endSession();
    }
    if (!product) throw new Error("Product creation transaction completed without creating a product.");
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ error: duplicateFieldMessage(error) }, { status: 409 });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      return validationErrorResponse(error);
    }
    console.error("Product creation failed:", error);
    return NextResponse.json({ error: "Unable to create product." }, { status: 500 });
  }
}

function duplicateFieldMessage(error: { keyPattern?: Record<string, unknown> }) {
  if (error.keyPattern?.barcode) return "Barcode is already in use.";
  if (error.keyPattern?.sku) return "SKU is already in use.";
  return "Product slug already exists.";
}
