import type { Product as ProductSchema } from "@/models/Product";

export const FOOD_RELATED_REGEX =
  /\b(?:food|grocer(?:y|ies)|perishable|fresh\s+produce|produce|fruit(?![\s-]+bowl)|vegetable(?![\s-]+peeler)|vegetables|meats?|poultry|seafood|dairy|milk(?![\s-]+(?:frother|bottle|jug))|cheese(?![\s-]+board)|yogh?urt|bread(?![\s-]+box)|bakery|egg(?![\s-]+timer)|eggs|beverages?|drinks?|snacks?|spices?|flour|rice(?![\s-]+cooker))\b/i;

export function containsFoodRelatedText(...values: Array<string | null | undefined>) {
  return values.some((value) => {
    if (typeof value !== "string") return false;
    const text = value.replace(
      /\b(?:rice[\s-]+cooker|milk[\s-]+(?:frother|bottle|jug)|bread[\s-]+box|cheese[\s-]+board|fruit[\s-]+bowl|vegetable[\s-]+peeler|eggs?[\s-]+timer)\b/gi,
      "",
    );
    return valueRelatedToFood(text);
  });
}

function valueRelatedToFood(value: string | null | undefined) {
  return typeof value === "string" && FOOD_RELATED_REGEX.test(value);
}

type CatalogItem = Pick<ProductSchema, "name" | "brand" | "description"> & {
  shortDescription?: string;
  category?: unknown;
};

export function isAllowedNonFoodProduct(item: CatalogItem): boolean {
  let category = "";
  if (typeof item.category === "string") {
    category = item.category;
  } else if (typeof item.category === "object" && item.category !== null) {
    const categoryRecord = item.category as { name?: unknown; slug?: unknown };
    category = [
      typeof categoryRecord.name === "string" ? categoryRecord.name : "",
      typeof categoryRecord.slug === "string" ? categoryRecord.slug : "",
    ].join(" ");
  }

  return !containsFoodRelatedText(
    item.name,
    item.brand,
    item.shortDescription,
    item.description,
    category,
  );
}

export const AI_NON_FOOD_CATEGORIES = [
  "Stationery",
  "Toys",
  "Gifts",
  "Kitchenware",
  "Beauty & Personal Care",
  "Household Items",
  "Baby Care",
  "Home Decor",
  "Plastic Items",
  "Bags",
  "Water Bottles",
  "Lunch Boxes & Storage",
] as const;
