import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { isValidObjectId, Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { ProductFilters } from "@/components/admin/product-filters";
import { getAdminSession } from "@/lib/admin-session";
import { cloudinaryImageUrl, isCloudinaryImageUrl } from "@/lib/cloudinary-url";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { connectToDatabase } from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

const activeProducts = { status: { $ne: "archived" } };
const quantityExpression = {
  $cond: [
    { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
    {
      $reduce: {
        input: { $ifNull: ["$variants", []] },
        initialValue: 0,
        in: { $add: ["$$value", { $ifNull: ["$$this.stock", 0] }] },
      },
    },
    { $ifNull: ["$stock", 0] },
  ],
};
const effectivePriceExpression = {
  $cond: [
    { $and: [{ $ne: ["$compareAtPrice", null] }, { $gt: ["$compareAtPrice", "$price"] }] },
    "$price",
    {
      $cond: [
        { $and: [{ $ne: ["$salePrice", null] }, { $lt: ["$salePrice", "$price"] }] },
        "$salePrice",
        "$price",
      ],
    },
  ],
};

type AdminProductsPageProps = {
  searchParams?: {
    stock?: string;
    q?: string;
    minQty?: string;
    maxQty?: string;
    listed?: string;
    priceOrder?: string;
    parentCategory?: string;
    category?: string;
    page?: string;
    branded?: string;
    local?: string;
    minPrice?: string;
    maxPrice?: string;
  };
};

const productsPerPage = 50;

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const session = await getAdminSession();
  await connectToDatabase();
  const filter: Record<string, unknown> = { ...activeProducts };
  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  const andConditions: Record<string, unknown>[] = [];

  if (searchParams?.stock === "out") {
    andConditions.push({ $expr: { $eq: [quantityExpression, 0] } });
  } else if (searchParams?.stock === "low") {
    andConditions.push({ $expr: { $and: [
      { $gt: [quantityExpression, 0] },
      { $lte: [quantityExpression, { $ifNull: ["$lowStockThreshold", 3] }] },
    ] } });
    sort = { stock: 1 };
  } else if (searchParams?.stock === "highest") {
    const highest = await Product.aggregate<{ quantity: number }>([
      { $match: filter },
      { $addFields: { quantity: quantityExpression } },
      { $match: { quantity: { $gt: 0 } } },
      { $group: { _id: null, quantity: { $max: "$quantity" } } },
    ]);
    andConditions.push({ $expr: { $eq: [quantityExpression, highest[0]?.quantity ?? -1] } });
    sort = { stock: -1 };
  } else if (searchParams?.stock === "lowest") {
    const lowest = await Product.aggregate<{ quantity: number }>([
      { $match: filter },
      { $addFields: { quantity: quantityExpression } },
      { $match: { quantity: { $gt: 0 } } },
      { $group: { _id: null, quantity: { $min: "$quantity" } } },
    ]);
    andConditions.push({ $expr: { $eq: [quantityExpression, lowest[0]?.quantity ?? -1] } });
    sort = { stock: 1 };
  }

  const query = searchParams?.q?.trim().slice(0, 100) ?? "";
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    andConditions.push({
      $or: ["name", "brand", "sku", "barcode"].map((field) => ({
        [field]: { $regex: escaped, $options: "i" },
      })),
    });
  }
  const minQuantity = parseNonNegativeInteger(searchParams?.minQty);
  const maxQuantity = parseNonNegativeInteger(searchParams?.maxQty);
  if (minQuantity !== undefined) andConditions.push({ $expr: { $gte: [quantityExpression, minQuantity] } });
  if (maxQuantity !== undefined) andConditions.push({ $expr: { $lte: [quantityExpression, maxQuantity] } });

  const listedDays = [7, 30, 90, 180].find((days) => String(days) === searchParams?.listed);
  if (listedDays) {
    andConditions.push({ createdAt: { $lte: new Date(Date.now() - listedDays * 86_400_000) } });
  }

  if (searchParams?.branded === "1") {
    andConditions.push({ brand: { $exists: true, $nin: [""], $not: /^local$/i } });
  } else if (searchParams?.local === "1") {
    andConditions.push({ brand: { $regex: /^local$/i } });
  }

  if (searchParams?.category && isValidObjectId(searchParams.category)) {
    const selectedCategory = new Types.ObjectId(searchParams.category);
    andConditions.push({
      $or: [{ category: selectedCategory }, { categories: selectedCategory }],
    });
  } else if (searchParams?.parentCategory && isValidObjectId(searchParams.parentCategory)) {
    const selectedParent = new Types.ObjectId(searchParams.parentCategory);
    const descendants = await Category.find({ parentCategory: selectedParent }).select("_id").lean();
    const categoryIds = [selectedParent, ...descendants.map((category) => category._id)];
    andConditions.push({
      $or: [{ category: { $in: categoryIds } }, { categories: { $in: categoryIds } }],
    });
  }

  const minPrice = parseNonNegativeNumber(searchParams?.minPrice);
  const maxPrice = parseNonNegativeNumber(searchParams?.maxPrice);
  if (minPrice !== undefined) andConditions.push({ $expr: { $gte: [effectivePriceExpression, minPrice] } });
  if (maxPrice !== undefined) andConditions.push({ $expr: { $lte: [effectivePriceExpression, maxPrice] } });
  if (andConditions.length > 0) filter.$and = andConditions;

  const requestedPage = Math.max(1, parseNonNegativeInteger(searchParams?.page) ?? 1);
  const [totalProducts, categories, highestPricedProduct] = await Promise.all([
    Product.countDocuments(filter),
    Category.find().sort({ name: 1 }).select("name parentCategory").lean(),
    Product.findOne(activeProducts).sort({ price: -1 }).select("price").lean(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * productsPerPage;
  const priceDirection = searchParams?.priceOrder === "expensive" ? -1 : 1;
  const products = searchParams?.priceOrder === "expensive" || searchParams?.priceOrder === "cheap"
    ? await Product.aggregate<{
      _id: Types.ObjectId;
      name: string;
      slug: string;
      price: number;
      salePrice?: number | null;
      compareAtPrice?: number | null;
      stock: number;
      variants?: { stock: number }[];
      lowStockThreshold?: number;
      status: string;
      images: { url: string; alt?: string }[];
    }>([
      { $match: filter },
      { $addFields: { _adminEffectivePrice: effectivePriceExpression } },
      { $sort: { _adminEffectivePrice: priceDirection, _id: 1 } },
      { $skip: skip },
      { $limit: productsPerPage },
      {
        $project: {
          name: 1,
          slug: 1,
          price: 1,
          salePrice: 1,
          compareAtPrice: 1,
          stock: 1,
          variants: 1,
          lowStockThreshold: 1,
          status: 1,
          images: 1,
        },
      },
    ])
    : await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(productsPerPage)
      .select("name slug price salePrice compareAtPrice stock variants.stock lowStockThreshold status images")
      .lean();
  const maximumPrice = highestPricedProduct?.price ?? 100000;
  const priceCeiling = Math.max(100, maximumPrice);
  const initialMinPrice = Math.min(parseNonNegativeNumber(searchParams?.minPrice) ?? 0, priceCeiling);
  const initialMaxPrice = Math.max(
    initialMinPrice,
    Math.min(parseNonNegativeNumber(searchParams?.maxPrice) ?? priceCeiling, priceCeiling),
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-olive">Catalog</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-charcoal sm:text-[2rem]">Products</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your product catalog and inventory.</p>
        </div>
        {session?.accessLevel !== "View Only" && <Button asChild className="h-11 rounded-xl px-5 shadow-sm">
          <Link href="/admin/products/new">
            <Plus aria-hidden="true" className="mr-2 size-4" />
            Add product
          </Link>
        </Button>}
      </div>

      <ProductFilters
        key={JSON.stringify(searchParams ?? {})}
        categories={categories.map((category) => ({
          id: category._id.toString(),
          name: category.name,
          parentCategoryId: category.parentCategory?.toString(),
        }))}
        maximumPrice={maximumPrice}
        initial={{
          q: query,
          minQty: searchParams?.minQty ?? "",
          maxQty: searchParams?.maxQty ?? "",
          listed: listedDays ? String(listedDays) : "",
          priceOrder: searchParams?.priceOrder ?? "",
          parentCategory: searchParams?.parentCategory ?? "",
          category: searchParams?.category ?? "",
          branded: searchParams?.branded === "1",
          local: searchParams?.local === "1",
          minPrice: initialMinPrice,
          maxPrice: initialMaxPrice,
        }}
      />

      <Card className="overflow-hidden rounded-2xl border-black/[0.06] bg-white shadow-sm">
        <CardHeader className="border-b border-black/[0.05] px-5 py-5 sm:px-6">
          <CardTitle className="text-base">All products <span className="ml-1 font-normal text-muted-foreground">({totalProducts})</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#fafbf9]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 pl-5 text-[11px] font-semibold uppercase tracking-wider sm:pl-6">Image</TableHead>
                  <TableHead className="min-w-52 text-[11px] font-semibold uppercase tracking-wider">Title</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Inventory</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Price</TableHead>
                  <TableHead className="pr-5 text-right text-[11px] font-semibold uppercase tracking-wider sm:pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product._id.toString()}>
                    <TableCell className="pl-5 sm:pl-6">
                      {product.images?.[0]?.url ? (
                        <Image
                          src={cloudinaryImageUrl(product.images[0].url, 52)}
                          unoptimized={isCloudinaryImageUrl(product.images[0].url)}
                          alt={product.images?.[0]?.alt || product.name}
                          width={52}
                          height={52}
                          className="size-12 rounded-xl border border-black/10 bg-muted object-cover"
                        />
                      ) : (
                        <div aria-hidden="true" className="grid size-12 place-items-center rounded-xl border border-black/10 bg-muted/50 text-[10px] font-medium text-muted-foreground">No image</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-brand-charcoal">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.slug}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                        product.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                      }`}>
                        <span className={`size-1.5 rounded-full ${product.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {product.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const variants = product.variants ?? [];
                        const variantQuantity = variants.reduce((total: number, variant: { stock: number }) => total + variant.stock, 0);
                        const totalStock = variants.length > 0 ? variantQuantity : product.stock;
                        return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        totalStock === 0
                          ? "bg-destructive/10 text-destructive"
                          : totalStock <= (product.lowStockThreshold ?? 3)
                            ? "bg-amber-100 text-amber-800"
                            : "bg-brand-olive/10 text-brand-olive"
                      }`}>
                        {totalStock === 0 ? "Out of stock" : `${totalStock} in stock`}
                      </span>;
                      })()}
                      {(() => {
                        const variants = product.variants ?? [];
                        const variantQuantity = variants.reduce((total: number, variant: { stock: number }) => total + variant.stock, 0);
                        const totalStock = variants.length > 0 ? variantQuantity : product.stock;
                        return totalStock > 0 && totalStock <= (product.lowStockThreshold ?? 3);
                      })() && (
                        <p className="mt-1 text-xs text-destructive">Low stock</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
                        <span>
                          <span className="font-medium">PKR {product.price.toLocaleString()}</span>
                          <span className="ml-2 text-xs text-muted-foreground line-through">
                            PKR {product.compareAtPrice.toLocaleString()}
                          </span>
                        </span>
                      ) : product.salePrice != null ? (
                        <span>
                          <span className="font-medium">PKR {product.salePrice.toLocaleString()}</span>
                          <span className="ml-2 text-xs text-muted-foreground line-through">
                            PKR {product.price.toLocaleString()}
                          </span>
                        </span>
                      ) : (
                        `PKR ${product.price.toLocaleString()}`
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right sm:pr-6">
                      {session?.accessLevel !== "View Only" && <ProductRowActions id={product._id.toString()} name={product.name} />}
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center text-muted-foreground">
                      No products yet. Add your first product to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <nav aria-label="Product pages" className="flex items-center justify-center gap-4">
          <Link
            href={buildPageHref(searchParams, currentPage - 1)}
            aria-disabled={currentPage === 1}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}
          >
            Previous
          </Link>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Link
            href={buildPageHref(searchParams, currentPage + 1)}
            aria-disabled={currentPage === totalPages}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}
          >
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}

function parseNonNegativeInteger(value?: string) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 1_000_000 ? parsed : undefined;
}

function parseNonNegativeNumber(value?: string) {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed <= 10_000_000 ? parsed : undefined;
}

function buildPageHref(searchParams: AdminProductsPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key !== "page" && typeof value === "string" && value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/admin/products?${params.toString()}`;
}
