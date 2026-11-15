import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireAdmin } from "@/lib/admin-session";
import { isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import { isDuplicateKeyError, validationErrorResponse } from "@/lib/api-errors";
import { connectToDatabase } from "@/lib/db";
import { productInputBaseSchema } from "@/lib/product-validation";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { containsFoodRelatedText } from "@/lib/catalog-policy";
import { getAdminSession } from "@/lib/admin-session";
import TrashEntry from "@/models/TrashEntry";
import { productRichTextLength, sanitizeProductRichText } from "@/lib/product-rich-text";

type RouteContext = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const product = await Product.findById(params.id).select("+costPrice").lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (error) {
    console.error("Product lookup failed:", error);
    return NextResponse.json({ error: "Unable to load product." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  let input;
  try {
    input = productInputBaseSchema.partial().parse(await request.json());
    if (
      (input.shortDescription && productRichTextLength(input.shortDescription) > 300) ||
      (input.description && productRichTextLength(input.description) > 10000)
    ) {
      return NextResponse.json({ error: "Descriptions exceed their allowed character limits." }, { status: 400 });
    }
    if (input.shortDescription) input.shortDescription = sanitizeProductRichText(input.shortDescription);
    if (input.description) input.description = sanitizeProductRichText(input.description);
    if (Object.keys(input).length === 0) {
      return NextResponse.json({ error: "Provide at least one product field." }, { status: 400 });
    }
  } catch (error) {
    return validationErrorResponse(error);
  }

  try {
    await connectToDatabase();
    const currentProduct = await Product.findById(params.id)
      .select("name brand shortDescription description price compareAtPrice category categories")
      .lean();
    if (!currentProduct) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const categoryIds = input.categories?.length
      ? input.categories
      : input.category
        ? [input.category]
        : currentProduct.categories?.length
          ? currentProduct.categories.map(String)
          : [currentProduct.category.toString()];
    const categories = await Category.find({ _id: { $in: categoryIds } })
      .select("name slug")
      .lean();
    if (categories.length !== new Set(categoryIds).size) {
      return NextResponse.json({ error: "One or more categories were not found." }, { status: 400 });
    }
    if (
      categories.some((category) => containsFoodRelatedText(category.name, category.slug)) ||
      !isAllowedNonFoodProduct({
        name: input.name ?? currentProduct.name,
        brand: input.brand ?? currentProduct.brand,
        shortDescription: input.shortDescription ?? currentProduct.shortDescription,
        description: input.description ?? currentProduct.description,
        category: categories.map((category) => `${category.name} ${category.slug}`).join(" "),
      })
    ) {
      return NextResponse.json(
        { error: "Food and grocery products are not supported by this store." },
        { status: 400 },
      );
    }
    if (
      input.compareAtPrice !== undefined &&
      input.compareAtPrice !== null &&
      input.compareAtPrice <= (input.price ?? currentProduct.price)
    ) {
      return NextResponse.json(
        { error: "Compare-at price must be greater than the product price." },
        { status: 400 },
      );
    }

    const product = await Product.findByIdAndUpdate(
      params.id,
      {
        $set: {
          ...input,
          category: categoryIds[0],
          categories: categoryIds,
        },
      },
      { new: true, runValidators: true },
    ).select("-costPrice");
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      if (error.keyPattern?.barcode) {
        return NextResponse.json({ error: "Barcode is already in use." }, { status: 409 });
      }
      if (error.keyPattern?.sku) {
        return NextResponse.json({ error: "SKU is already in use." }, { status: 409 });
      }
      return NextResponse.json({ error: "Product slug already exists." }, { status: 409 });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      return validationErrorResponse(error);
    }
    console.error("Product update failed:", error);
    return NextResponse.json({ error: "Unable to update product." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const product = await Product.findById(params.id).select("+costPrice");
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (product.deletedAt) {
      return NextResponse.json({ error: "Product is already in Trash." }, { status: 409 });
    }
    const session = await getAdminSession();
    const snapshot = product.toObject();
    await TrashEntry.create({
      entityType: "product",
      originalId: product._id,
      title: product.name,
      payload: snapshot,
      deletedBy: session?.sub,
    });
    product.status = "archived";
    product.deletedAt = new Date();
    await product.save();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Product archive failed:", error);
    return NextResponse.json({ error: "Unable to archive product." }, { status: 500 });
  }
}
