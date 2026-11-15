import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Category from "@/models/Category";
import Product, { type Product as ProductSchema } from "@/models/Product";

export const dynamic = "force-dynamic";

type EditProductPageProps = { params: { id: string } };

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await getAdminSession();
  if (!session || session.accessLevel === "View Only") redirect("/admin");
  if (!isValidObjectId(params.id)) notFound();
  await connectToDatabase();
  const [product, categories] = await Promise.all([
    Product.findById(params.id).select("+costPrice").lean(),
    Category.find().sort({ name: 1 }).select("name slug parentCategory").lean(),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-olive">Catalog</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-charcoal sm:text-[2rem]">Edit product</h1>
        <p className="mt-2 text-sm text-muted-foreground">Update product details, pricing, inventory, and media.</p>
      </div>
      <ProductForm
        categories={categories.map((category) => ({
          id: category._id.toString(),
          name: category.name,
          slug: category.slug,
          parentCategoryId: category.parentCategory?.toString(),
        }))}
        product={{
          id: product._id.toString(),
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          description: product.description ?? "",
          shortDescription: product.shortDescription ?? "",
          price:
            product.compareAtPrice != null && product.compareAtPrice > product.price
              ? product.price
              : product.salePrice != null && product.salePrice < product.price
                ? product.salePrice
                : product.price,
          compareAtPrice:
            product.compareAtPrice ??
            (product.salePrice != null && product.salePrice < product.price ? product.price : undefined),
          costPrice: product.costPrice,
          sku: product.sku,
          barcode: product.barcode,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold ?? 3,
          status: product.status === "active" ? "active" : "draft",
          categoryIds: product.categories?.length
            ? product.categories.map((categoryId: ProductSchema["categories"][number]) => categoryId.toString())
            : [product.category.toString()],
          variants: product.variants.map((variant: ProductSchema["variants"][number]) => ({
            name: variant.name,
            price: variant.price,
            salePrice: variant.salePrice,
            stock: variant.stock,
            image: variant.image
              ? {
                  url: variant.image.url,
                  publicId: variant.image.publicId ?? variant.image.url,
                  alt: variant.image.alt ?? `${product.name} ${variant.name}`,
                }
              : undefined,
          })),
          images: product.images.map((image: ProductSchema["images"][number]) => ({
            url: image.url,
            publicId: image.publicId ?? image.url,
            alt: image.alt ?? product.name,
          })),
        }}
      />
    </div>
  );
}
