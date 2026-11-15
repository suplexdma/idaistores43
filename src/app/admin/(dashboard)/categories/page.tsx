import { CategoryCreateDialog } from "@/components/admin/category-create-dialog";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
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

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const session = await getAdminSession();
  if (!session || session.accessLevel === "View Only") redirect("/admin");
  await connectToDatabase();
  const categories = await Category.find()
    .sort({ name: 1 })
    .select("name slug parentCategory")
    .populate("parentCategory", "name")
    .lean();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-brand-olive">Catalog</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-2 text-muted-foreground">Organize products into browseable groups.</p>
        </div>
        <CategoryCreateDialog
          categories={categories.map((category) => ({
            id: category._id.toString(),
            name: category.name,
            parentCategoryId:
              category.parentCategory && typeof category.parentCategory === "object" &&
              "_id" in category.parentCategory
                ? String(category.parentCategory._id)
                : undefined,
          }))}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All categories ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Parent category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category._id.toString()}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.slug}</TableCell>
                    <TableCell>
                      {category.parentCategory &&
                      typeof category.parentCategory === "object" &&
                      "name" in category.parentCategory
                        ? String(category.parentCategory.name)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-28 text-center text-muted-foreground">
                      No categories have been created yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
