"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productInputSchema } from "@/lib/product-validation";
import { cloudinaryImageLoader } from "@/lib/cloudinary-url";

type ProductImage = { url: string; publicId: string; alt: string };
type ProductVariant = { name: string; price?: number; salePrice?: number; stock: number; image?: ProductImage };
type ProductFormProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  description: string;
  shortDescription?: string;
  price: number;
  weight?: number;
  dimensions?: string;
  compareAtPrice?: number;
  costPrice?: number;
  sku?: string;
  barcode?: string;
  stock: number;
  lowStockThreshold: number;
  status: "draft" | "active" | "archived";
  categoryIds: string[];
  variants: ProductVariant[];
  images: ProductImage[];
};
type ProductFormProps = {
  categories: { id: string; name: string; slug: string; parentCategoryId?: string }[];
  product?: ProductFormProduct;
};
type ProductValues = {
  name: string;
  slug: string;
  brand: string;
  description: string;
  shortDescription: string;
  price: string;
  weight: string;
  dimensions: string;
  compareAtPrice: string;
  costPrice: string;
  sku: string;
  barcode: string;
  stock: string;
  lowStockThreshold: string;
  status: "draft" | "active";
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ProductForm({ categories: initialCategories, product }: ProductFormProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadInProgress = useRef(false);
  const saveInProgress = useRef(false);
  const [categories, setCategories] = useState(initialCategories);
  const initialCategory = initialCategories.find((category) =>
    product?.categoryIds.includes(category.id),
  );
  const [selectedParentId, setSelectedParentId] = useState(
    initialCategory?.parentCategoryId ?? initialCategory?.id ?? "",
  );
  const [selectedChildId, setSelectedChildId] = useState(
    initialCategory?.parentCategoryId ? initialCategory.id : "",
  );
  const initialCategoryHasChildren = initialCategories.some(
    (category) => category.parentCategoryId === initialCategory?.id,
  );
  const [categoryIds, setCategoryIds] = useState(
    initialCategory?.parentCategoryId
      ? [initialCategory.id]
      : initialCategoryHasChildren
        ? []
        : product?.categoryIds ?? (initialCategory ? [initialCategory.id] : []),
  );
  const [values, setValues] = useState<ProductValues>({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    brand: product?.brand ?? "",
    description: product?.description ?? "",
    shortDescription: product?.shortDescription ?? "",
    price: product ? String(product.price) : "",
    weight: product?.weight != null ? String(product.weight) : "",
    dimensions: product?.dimensions ?? "",
    compareAtPrice: product?.compareAtPrice != null ? String(product.compareAtPrice) : "",
    costPrice: product?.costPrice != null ? String(product.costPrice) : "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    stock: product ? String(product.stock) : "0",
    lowStockThreshold: String(product?.lowStockThreshold ?? 3),
    status: product?.status === "active" ? "active" : "draft",
  });
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [categoryName, setCategoryName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [serverError, setServerError] = useState("");
  const [draggedImage, setDraggedImage] = useState<number | null>(null);

  function updateValue<K extends keyof ProductValues>(key: K, value: ProductValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const parentCategories = categories.filter((category) => !category.parentCategoryId);
  const childCategories = categories.filter(
    (category) => category.parentCategoryId === selectedParentId,
  );

  function selectParent(id: string) {
    setSelectedParentId(id);
    setSelectedChildId("");
    const hasChildren = categories.some((category) => category.parentCategoryId === id);
    setCategoryIds(id && !hasChildren ? [id] : []);
  }

  function selectChild(id: string) {
    setSelectedChildId(id);
    setCategoryIds(id ? [id] : []);
  }

  async function createCategory() {
    const name = categoryName.trim();
    const slug = slugify(name);
    if (!name || !slug) {
      setServerError("Enter a category name using English letters or numbers.");
      return;
    }

    setServerError("");
    setCreatingCategory(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          ...(selectedParentId ? { parentCategory: selectedParentId } : {}),
        }),
      });
      const data: { category?: { _id: string }; error?: string | { message?: string }[] } =
        await response.json();
      if (!response.ok || !data.category) {
        const message = Array.isArray(data.error)
          ? data.error.map((issue) => issue.message).filter(Boolean).join(" ")
          : data.error;
        setServerError(message || "Unable to create category.");
        return;
      }

      const created = {
        id: data.category._id,
        name,
        slug,
        ...(selectedParentId ? { parentCategoryId: selectedParentId } : {}),
      };
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      if (selectedParentId) {
        setSelectedChildId(created.id);
        setCategoryIds([created.id]);
      } else {
        setSelectedParentId(created.id);
        setCategoryIds([created.id]);
      }
      setCategoryName("");
    } catch {
      setServerError("Unable to reach the category service. Please try again.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (images.length + files.length > 10) {
      setServerError("A product can have up to 10 images.");
      return;
    }

    setServerError("");
    setUploading(true);
    uploadInProgress.current = true;
    try {
      const uploaded: ProductImage[] = [];
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/admin/upload", { method: "POST", body });
        const data: { error?: string; image?: { secureUrl: string; publicId: string } } =
          await response.json();
        if (!response.ok || !data.image) {
          setServerError(data.error ?? "Image upload failed.");
          break;
        }
        uploaded.push({
          url: data.image.secureUrl,
          publicId: data.image.publicId,
          alt: values.name,
        });
      }
      if (uploaded.length > 0) setImages((current) => [...current, ...uploaded]);
    } catch {
      setServerError("Unable to upload the images. Please try again.");
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  }

  async function uploadVariantImage(index: number, file: File | undefined) {
    if (!file) return;
    setServerError("");
    setUploading(true);
    uploadInProgress.current = true;
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data: { error?: string; image?: { secureUrl: string; publicId: string } } = await response.json();
      if (!response.ok || !data.image) throw new Error(data.error ?? "Variant image upload failed.");
      const image = {
        url: data.image.secureUrl,
        publicId: data.image.publicId,
        alt: `${values.name} ${variants[index]?.name ?? "variant"}`,
      };
      setVariants((current) => current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, image } : variant,
      ));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to upload the variant image.");
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  }

  function reorderImage(from: number, to: number) {
    if (from === to || to < 0 || to >= images.length) return;
    setImages((current) => {
      const reordered = [...current];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      return reordered;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault();
    if (draggedImage !== null) reorderImage(draggedImage, targetIndex);
    setDraggedImage(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInProgress.current) return;
    if (uploadInProgress.current) {
      setServerError("Please wait for all image uploads to finish before saving.");
      return;
    }
    setServerError("");
    const parsed = productInputSchema.safeParse({
      name: values.name,
      slug: values.slug,
      brand: values.brand,
      shortDescription: values.shortDescription,
      description: values.description,
      price: Number(values.price),
      weight: values.weight === "" ? undefined : Number(values.weight),
      dimensions: values.dimensions.trim() || undefined,
      compareAtPrice: values.compareAtPrice === "" ? undefined : Number(values.compareAtPrice),
      costPrice: values.costPrice === "" ? undefined : Number(values.costPrice),
      sku: values.sku || undefined,
      barcode: values.barcode || undefined,
      stock: Number(values.stock),
      lowStockThreshold: Number(values.lowStockThreshold),
      category: categoryIds[0],
      categories: categoryIds,
      images,
      variants: variants.map((variant) => ({
        ...variant,
        ...(variant.price === undefined ? {} : { price: Number(variant.price) }),
        stock: Number(variant.stock),
      })),
      status: values.status,
      ...(product ? { salePrice: null } : {}),
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }

    setSaving(true);
    saveInProgress.current = true;
    try {
      const response = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setServerError(data.error ?? "Unable to save product.");
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setServerError("Unable to reach the product service. Please try again.");
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid items-start gap-5">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Product details</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Title</span>
              <Input
                required
                maxLength={160}
                value={values.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setValues((current) => ({
                    ...current,
                    name,
                    slug: product || current.slug ? current.slug : slugify(name),
                  }));
                }}
                placeholder="e.g. Woven table lamp"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Short description</span>
              <RichTextEditor
                label="Short description"
                value={values.shortDescription}
                onChange={(value) => updateValue("shortDescription", value)}
                maxLength={300}
                placeholder="A concise summary shown beneath the product title."
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Description</span>
              <RichTextEditor
                label="Long description"
                value={values.description}
                onChange={(value) => updateValue("description", value)}
                maxLength={10000}
                placeholder="Describe the product and what makes it useful."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">URL handle</span>
                <Input
                  required
                  value={values.slug}
                  onChange={(event) => updateValue("slug", slugify(event.target.value))}
                  placeholder="woven-table-lamp"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Brand</span>
                <Input required maxLength={100} value={values.brand} onChange={(event) => updateValue("brand", event.target.value)} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Media</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => void uploadFiles(event)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-5 text-sm text-muted-foreground transition hover:border-brand-olive hover:bg-brand-olive/5 disabled:opacity-60"
            >
              <UploadCloud aria-hidden="true" className="size-6 text-brand-olive" />
              <span className="font-medium text-foreground">{uploading ? "Uploading images..." : "Add images"}</span>
              <span>JPEG, PNG or WebP · up to 5 MB each · maximum 10</span>
            </button>
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((image, index) => (
                  <div
                    key={`${image.publicId}-${index}`}
                    draggable
                    onDragStart={() => setDraggedImage(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, index)}
                    onDragEnd={() => setDraggedImage(null)}
                    className="group relative overflow-hidden rounded-lg border bg-background"
                  >
                    <Image src={image.url} loader={cloudinaryImageLoader} alt={image.alt || values.name || "Product image"} width={320} height={240} sizes="(max-width: 640px) 50vw, 33vw" className="aspect-[4/3] w-full object-cover" />
                    <div className="flex items-center justify-between gap-1 border-t px-2 py-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GripVertical aria-hidden="true" className="size-3.5" /> Image {index + 1}
                      </span>
                      <span className="flex">
                        <Button type="button" variant="ghost" size="icon" aria-label={`Move image ${index + 1} up`} disabled={index === 0} onClick={() => reorderImage(index, index - 1)}>
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Move image ${index + 1} down`} disabled={index === images.length - 1} onClick={() => reorderImage(index, index + 1)}>
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove image ${index + 1}`} onClick={() => setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                          <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                        </Button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Status</CardTitle></CardHeader>
          <CardContent>
            <Select value={values.status} onValueChange={(value) => updateValue("status", value as ProductValues["status"])}>
              <SelectTrigger aria-label="Product status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">Active products are visible in your storefront.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Product organization</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              Parent category
              <select
                value={selectedParentId}
                onChange={(event) => selectParent(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a parent category</option>
                {parentCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            {selectedParentId && childCategories.length > 0 ? (
              <label className="block space-y-2 text-sm font-medium">
                Child category
                <select
                  value={selectedChildId}
                  onChange={(event) => selectChild(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a child category</option>
                  {childCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                {selectedParentId
                  ? "This parent has no child categories; products will be assigned directly to it."
                  : "Create or select a parent category to continue."}
              </p>
            )}
            <div className="space-y-2 border-t pt-4">
              <label htmlFor="inline-category" className="text-sm font-medium">Create category</label>
              <div className="flex gap-2">
                <Input id="inline-category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category name" onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createCategory();
                  }
                }} />
                <Button type="button" variant="outline" aria-label="Create and select category" disabled={creatingCategory || !categoryName.trim()} onClick={() => void createCategory()}>
                  <Plus aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Selling price (PKR)</span>
              <Input required type="number" min="0" step="0.01" value={values.price} onChange={(event) => updateValue("price", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Compare-at price (PKR)</span>
              <Input type="number" min="0" step="0.01" value={values.compareAtPrice} onChange={(event) => updateValue("compareAtPrice", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Cost price / buying price (PKR) · internal</span>
              <Input type="number" min="0" step="0.01" value={values.costPrice} onChange={(event) => updateValue("costPrice", event.target.value)} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Shipping details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Weight (kg) <span className="font-normal text-muted-foreground">· optional</span></span>
              <Input type="number" min="0" step="0.001" value={values.weight} onChange={(event) => updateValue("weight", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Dimensions (cm) <span className="font-normal text-muted-foreground">· optional</span></span>
              <Input maxLength={120} value={values.dimensions} onChange={(event) => updateValue("dimensions", event.target.value)} placeholder="10 x 10 x 10 cm" />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Inventory</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">SKU</span>
              <Input maxLength={100} value={values.sku} onChange={(event) => updateValue("sku", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Barcode <span className="font-normal text-muted-foreground">· optional, must be unique</span></span>
              <Input maxLength={100} value={values.barcode} onChange={(event) => updateValue("barcode", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Quantity</span>
              <Input required type="number" min="0" step="1" value={values.stock} onChange={(event) => updateValue("stock", event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Alert when stock reaches</span>
              <Input required type="number" min="0" step="1" value={values.lowStockThreshold} onChange={(event) => updateValue("lowStockThreshold", event.target.value)} />
              <span className="block text-xs text-muted-foreground">Low-stock alert threshold (default 3).</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-lg">
              Variants
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVariants((current) => [...current, { name: "", stock: 0 }])}
              >
                <Plus aria-hidden="true" className="mr-1 size-4" /> Add variant
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options. Add variants for sizes, colors, or other choices.</p>
            ) : variants.map((variant, index) => (
              <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium">
                  Option name
                  <Input
                    required
                    maxLength={100}
                    value={variant.name}
                    placeholder="Size: M"
                    onChange={(event) => setVariants((current) => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ))}
                  />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Stock
                  <Input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={variant.stock}
                    onChange={(event) => setVariants((current) => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, stock: Number(event.target.value) } : item,
                    ))}
                  />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Price override (PKR, optional)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.price ?? ""}
                    onChange={(event) => setVariants((current) => current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, price: event.target.value === "" ? undefined : Number(event.target.value) }
                        : item,
                    ))}
                  />
                </label>
                <div className="flex items-end justify-between gap-2">
                  <label className="min-w-0 flex-1 space-y-1 text-xs font-medium">
                    Sale price (PKR, optional)
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.salePrice ?? ""}
                      onChange={(event) => setVariants((current) => current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, salePrice: event.target.value === "" ? undefined : Number(event.target.value) }
                          : item,
                      ))}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove variant ${index + 1}`}
                    onClick={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 sm:col-span-2">
                  {variant.image?.url && (
                    <Image
                      src={variant.image.url}
                      loader={cloudinaryImageLoader}
                      alt={variant.image.alt || `${values.name} ${variant.name}`}
                      width={64}
                      height={64}
                      sizes="64px"
                      className="size-16 rounded-md border object-cover"
                    />
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition hover:bg-muted">
                    <UploadCloud aria-hidden="true" className="size-4" />
                    {variant.image ? "Replace variant image" : "Upload variant image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(event) => {
                        void uploadVariantImage(index, event.currentTarget.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {uploading && <span role="status" className="text-xs text-muted-foreground">Uploading image...</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {serverError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive lg:col-span-2">{serverError}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end lg:col-span-2">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>Cancel</Button>
        <Button type="submit" disabled={saving || uploading || creatingCategory}>
          {saving ? "Saving..." : product ? "Save changes" : "Save product"}
        </Button>
      </div>
    </form>
  );
}
