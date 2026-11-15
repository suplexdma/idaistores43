import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Category from "@/models/Category";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const session = await getAdminSession();
  if (!session || session.accessLevel === "View Only") redirect("/admin");
  await connectToDatabase();
  const categories = await Category.find().sort({ name: 1 }).select("name slug parentCategory").lean();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-olive">Catalog</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-charcoal sm:text-[2rem]">Add product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add product details to your store catalog.
        </p>
      </div>
      <ProductForm
        categories={categories.map((category) => ({
          id: category._id.toString(),
          name: category.name,
          slug: category.slug,
          parentCategoryId: category.parentCategory?.toString(),
        }))}
      />
    </div>
  );
}
