import { z } from "zod";

const productImageInputSchema = z.object({
  url: z.string().url(),
  publicId: z.string().trim().optional(),
  alt: z.string().trim().max(250).optional(),
});

const productVariantInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(100).optional(),
  price: z.number().finite().min(0).optional(),
  salePrice: z.number().finite().min(0).optional(),
  stock: z.number().int().min(0),
  image: productImageInputSchema.optional(),
});

export const productInputBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase, hyphenated slug."),
  brand: z.string().trim().min(1).max(100),
  category: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  categories: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50).optional(),
  price: z.number().finite().min(0),
  costPrice: z.number().finite().min(0).optional(),
  compareAtPrice: z.number().finite().min(0).optional(),
  salePrice: z.number().finite().min(0).nullable().optional(),
  sku: z.string().trim().max(100).optional(),
  barcode: z.string().trim().max(100).optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(3),
  shortDescription: z.string().trim().max(1500).optional(),
  description: z.string().trim().max(50000).optional(),
  images: z.array(productImageInputSchema).max(10).optional(),
  variants: z.array(productVariantInputSchema).max(50).optional(),
  specs: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    value: z.string().trim().min(1).max(500),
  })).max(50).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const productInputSchema = productInputBaseSchema.superRefine((input, context) => {
  const categories = input.categories?.length ? input.categories : input.category ? [input.category] : [];
  const hasCategorySelection = input.category !== undefined || input.categories !== undefined;
  if (hasCategorySelection && categories.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["categories"],
      message: "Choose at least one category.",
    });
  }
  if (new Set(categories).size !== categories.length) {
    context.addIssue({
      code: "custom",
      path: ["categories"],
      message: "A category can only be selected once.",
    });
  }
  if (input.compareAtPrice !== undefined && input.compareAtPrice <= input.price) {
    context.addIssue({
      code: "custom",
      path: ["compareAtPrice"],
      message: "Compare-at price must be greater than the product price.",
    });
  }
  const variantNames = input.variants?.map((variant) => variant.name.toLowerCase()) ?? [];
  if (new Set(variantNames).size !== variantNames.length) {
    context.addIssue({
      code: "custom",
      path: ["variants"],
      message: "Variant names must be unique.",
    });
  }
  input.variants?.forEach((variant, index) => {
    const regularVariantPrice = variant.price ?? input.price;
    if (variant.salePrice !== undefined && variant.salePrice >= regularVariantPrice) {
      context.addIssue({
        code: "custom",
        path: ["variants", index, "salePrice"],
        message: "Variant sale price must be lower than its price.",
      });
    }
  });
});

export type ProductInput = z.infer<typeof productInputSchema>;
