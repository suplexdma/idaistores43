import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, PipelineStage, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { containsFoodRelatedText, FOOD_RELATED_REGEX } from "@/lib/catalog-policy";
import Category from "@/models/Category";
import Product from "@/models/Product";
import Review from "@/models/Review";

const MAX_PAGE_SIZE = 100;
const sortOptions = ["newest", "price-asc", "price-desc", "trending"] as const;
type ProductSort = (typeof sortOptions)[number];

const effectivePriceExpression = {
  $cond: [
    {
      $and: [
        { $ne: ["$compareAtPrice", null] },
        { $gt: ["$compareAtPrice", "$price"] },
      ],
    },
    "$price",
    {
      $cond: [
        {
          $and: [
        { $ne: ["$salePrice", null] },
        { $lt: ["$salePrice", "$price"] },
          ],
        },
        "$salePrice",
        "$price",
      ],
    },
  ],
};
const effectiveStockExpression = {
  $cond: [
    { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
    {
      $reduce: {
        input: { $ifNull: ["$variants", []] },
        initialValue: 0,
        in: { $add: ["$$value", { $ifNull: ["$$this.stock", 0] }] },
      },
    },
    "$stock",
  ],
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = parsePositiveInteger(params.get("page"), 1);
  const limit = parsePositiveInteger(params.get("limit"), 20);
  const includeTotal = params.get("includeTotal") !== "false";
  const sortValue = params.get("sort") ?? "newest";
  if (!page || !limit || limit > MAX_PAGE_SIZE) {
    return NextResponse.json(
      { error: `page and limit must be positive integers; limit max is ${MAX_PAGE_SIZE}.` },
      { status: 400 },
    );
  }
  if (!sortOptions.includes(sortValue as ProductSort)) {
    return NextResponse.json({ error: "Unsupported sort option." }, { status: 400 });
  }

  const filter: Record<string, unknown> = { status: "active" };
  const search = params.get("search")?.trim().slice(0, 100);
  if (containsFoodRelatedText(search)) {
    return productListResponse([], 0, page, limit);
  }
  const categories = Array.from(
    new Set(params.getAll("category").map((id) => id.trim()).filter(Boolean)),
  );
  const minPrice = parseOptionalPrice(params.get("minPrice"));
  const maxPrice = parseOptionalPrice(params.get("maxPrice"));
  const minRating = parseOptionalRating(params.get("minRating"));
  const inStock = params.get("inStock");

  if (params.has("minPrice") && minPrice === null) {
    return NextResponse.json({ error: "minPrice must be a non-negative number." }, { status: 400 });
  }
  if (params.has("maxPrice") && maxPrice === null) {
    return NextResponse.json({ error: "maxPrice must be a non-negative number." }, { status: 400 });
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return NextResponse.json({ error: "minPrice must not exceed maxPrice." }, { status: 400 });
  }
  if (params.has("minRating") && minRating === null) {
    return NextResponse.json({ error: "minRating must be between 1 and 5." }, { status: 400 });
  }
  if (inStock !== null && inStock !== "true" && inStock !== "false") {
    return NextResponse.json({ error: "inStock must be true or false." }, { status: 400 });
  }
  if (search) {
    filter.$and = [{
      $or: [
        { barcode: search },
        { sku: search.toUpperCase() },
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ],
    }];
  }
  if (categories.length > 0) {
    if (categories.some((categoryId) => !isValidObjectId(categoryId))) {
      return NextResponse.json({ error: "Invalid category id." }, { status: 400 });
    }
  }
  const priceConditions: Record<string, unknown>[] = [];
  if (minPrice !== null) priceConditions.push({ $gte: [effectivePriceExpression, minPrice] });
  if (maxPrice !== null) priceConditions.push({ $lte: [effectivePriceExpression, maxPrice] });
  const stockConditions =
    inStock === "true" ? [{ $gt: [effectiveStockExpression, 0] }] : [];
  if (priceConditions.length > 0 || stockConditions.length > 0) {
    filter.$expr = { $and: [...priceConditions, ...stockConditions] };
  }

  try {
    await connectToDatabase();
    const categoriesAllowed = await Category.find()
      .select("name slug parentCategory")
      .lean();
    const allowedCategoryIds = categoriesAllowed
      .filter((category) => !containsFoodRelatedText(category.name, category.slug))
      .map((category) => category._id);
    if (allowedCategoryIds.length === 0) {
      return productListResponse([], 0, page, limit);
    }

    let categoryFilterIds = allowedCategoryIds.map((id) => id.toString());
    if (categories.length > 0) {
      categoryFilterIds = categoriesAllowed
        .filter((category) =>
          !containsFoodRelatedText(category.name, category.slug) &&
          (categories.includes(category._id.toString()) ||
            (category.parentCategory && categories.includes(category.parentCategory.toString()))),
        )
        .map((category) => category._id.toString());
      if (categoryFilterIds.length === 0) {
        return productListResponse([], 0, page, limit);
      }
    }
    const categoryObjectIds = categoryFilterIds.map((categoryId) => new Types.ObjectId(categoryId));
    filter.$or = [
      { category: { $in: categoryObjectIds } },
      { categories: { $in: categoryObjectIds } },
    ];
    filter.$nor = [
      { name: { $regex: FOOD_RELATED_REGEX } },
      { brand: { $regex: FOOD_RELATED_REGEX } },
      { shortDescription: { $regex: FOOD_RELATED_REGEX } },
      { description: { $regex: FOOD_RELATED_REGEX } },
    ];

    if (minRating !== null) {
      const ratedProducts = await Review.aggregate<{ _id: Types.ObjectId }>([
        { $match: { status: "Approved" } },
        { $group: { _id: "$productId", averageRating: { $avg: "$rating" } } },
        { $match: { averageRating: { $gte: minRating } } },
      ]);
      if (ratedProducts.length === 0) {
        return productListResponse([], 0, page, limit);
      }
      filter._id = { $in: ratedProducts.map(({ _id }) => _id) };
    }

    const total = includeTotal ? await Product.countDocuments(filter) : 0;
    const sort: Record<string, 1 | -1> =
      search
        ? { exactBarcodeMatch: -1, exactSkuMatch: -1, createdAt: -1, _id: -1 }
        :
      sortValue === "price-asc"
        ? { effectivePrice: 1, _id: 1 }
        : sortValue === "price-desc"
          ? { effectivePrice: -1, _id: 1 }
          : { createdAt: -1, _id: -1 };

    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $addFields: {
          effectivePrice: effectivePriceExpression,
          stock: effectiveStockExpression,
          exactBarcodeMatch: search ? { $cond: [{ $eq: [{ $ifNull: ["$barcode", ""] }, search] }, 1, 0] } : 0,
          exactSkuMatch: search ? { $cond: [{ $eq: [{ $ifNull: ["$sku", ""] }, search.toUpperCase()] }, 1, 0] } : 0,
        },
      },
    ];
    if (sortValue === "trending") {
      pipeline.push(
        {
          $lookup: {
            from: "reviews",
            let: { currentProductId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$productId", "$$currentProductId"] },
                      { $eq: ["$status", "Approved"] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: "$rating" },
                  reviewCount: { $sum: 1 },
                },
              },
            ],
            as: "trendReviews",
          },
        },
        {
          $addFields: {
            trendRating: { $ifNull: [{ $first: "$trendReviews.averageRating" }, 0] },
            trendReviewCount: { $ifNull: [{ $first: "$trendReviews.reviewCount" }, 0] },
          },
        },
      );
    }
    pipeline.push(
      {
        $sort:
          sortValue === "trending"
            ? { trendRating: -1, trendReviewCount: -1, createdAt: -1, _id: -1 }
            : sort,
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          costPrice: 0,
          effectivePrice: 0,
          trendRating: 0,
          trendReviewCount: 0,
          trendReviews: 0,
          "category.parentCategory": 0,
          "category.createdAt": 0,
          "category.updatedAt": 0,
        },
      },
    );
    const products = await Product.aggregate<Record<string, unknown>>(pipeline);
    const productIds = products
      .map((product) => product._id)
      .filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
    const ratings = productIds.length
      ? await Review.aggregate<{ _id: Types.ObjectId; averageRating: number; reviewCount: number }>([
          { $match: { productId: { $in: productIds }, status: "Approved" } },
          {
            $group: {
              _id: "$productId",
              averageRating: { $avg: "$rating" },
              reviewCount: { $sum: 1 },
            },
          },
        ])
      : [];
    const ratingByProduct = new Map(
      ratings.map((rating) => [
        rating._id.toString(),
        { averageRating: rating.averageRating, reviewCount: rating.reviewCount },
      ]),
    );
    const productsWithRatings = products.map((product) => ({
      ...product,
      rating: ratingByProduct.get(String(product._id)) ?? { averageRating: 0, reviewCount: 0 },
    }));

    return includeTotal
      ? productListResponse(productsWithRatings, total, page, limit)
      : NextResponse.json({ products: productsWithRatings });
  } catch (error) {
    console.error("Product listing failed:", error);
    return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
  }
}

function productListResponse(
  products: Record<string, unknown>[],
  total: number,
  page: number,
  limit: number,
) {
  return NextResponse.json({
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

function parsePositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalPrice(value: string | null): number | null {
  if (value === null) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalRating(value: string | null): number | null {
  if (value === null) return null;
  if (!/^[1-5](?:\.\d)?$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= 5 ? parsed : null;
}
