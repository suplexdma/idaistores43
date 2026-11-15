"use client";

import { FormEvent, useState } from "react";
import { ListFilter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CategoryOption = { id: string; name: string; parentCategoryId?: string };
type ProductFilterValues = {
  q: string;
  minQty: string;
  maxQty: string;
  listed: string;
  priceOrder: string;
  parentCategory: string;
  category: string;
  branded: boolean;
  local: boolean;
  minPrice: number;
  maxPrice: number;
};

type ProductFiltersProps = {
  categories: CategoryOption[];
  maximumPrice: number;
  initial: ProductFilterValues;
};

export function ProductFilters({ categories, maximumPrice, initial }: ProductFiltersProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [open, setOpen] = useState(false);
  const priceCeiling = Math.max(100, maximumPrice);
  const parents = categories.filter((category) => !category.parentCategoryId);
  const children = categories.filter((category) => category.parentCategoryId === values.parentCategory);

  function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const params = new URLSearchParams();
    const entries: Array<[keyof ProductFilterValues, string]> = [
      ["q", values.q.trim()],
      ["minQty", values.minQty],
      ["maxQty", values.maxQty],
      ["listed", values.listed],
      ["priceOrder", values.priceOrder],
      ["parentCategory", values.parentCategory],
      ["category", values.category],
      ["minPrice", values.minPrice > 0 ? String(values.minPrice) : ""],
      ["maxPrice", values.maxPrice < priceCeiling ? String(values.maxPrice) : ""],
    ];
    for (const [key, value] of entries) if (value) params.set(key, value);
    if (values.branded) params.set("branded", "1");
    if (values.local) params.set("local", "1");
    const query = params.toString();
    router.push(`/admin/products${query ? `?${query}` : ""}`);
    setOpen(false);
  }

  function resetFilters() {
    setValues({
      q: values.q,
      minQty: "",
      maxQty: "",
      listed: "",
      priceOrder: "",
      parentCategory: "",
      category: "",
      branded: false,
      local: false,
      minPrice: 0,
      maxPrice: priceCeiling,
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={applyFilters} className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl border bg-white p-2 shadow-sm">
        <Search aria-hidden="true" className="ml-2 size-5 shrink-0 text-brand-olive" />
        <Input
          value={values.q}
          onChange={(event) => setValues((current) => ({ ...current, q: event.target.value }))}
          placeholder="Search products by name, brand, SKU or barcode..."
          aria-label="Search CMS products"
          className="h-11 border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" className="h-10 shrink-0 px-4">Search</Button>
      </form>

      <div className="flex justify-center">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <ListFilter aria-hidden="true" className="size-4" /> Filters
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Filter products</DialogTitle>
              <DialogDescription>Combine inventory, age, price, category and brand filters.</DialogDescription>
            </DialogHeader>
            <form onSubmit={applyFilters} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Max Quantity
                  <Input type="number" min="0" value={values.maxQty} onChange={(event) => setValues((current) => ({ ...current, maxQty: event.target.value }))} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Min Quantity
                  <Input type="number" min="0" value={values.minQty} onChange={(event) => setValues((current) => ({ ...current, minQty: event.target.value }))} />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Old Listed
                  <select value={values.listed} onChange={(event) => setValues((current) => ({ ...current, listed: event.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Any listing date</option>
                    <option value="7">7 days ago</option>
                    <option value="30">30 days ago</option>
                    <option value="90">3 months ago</option>
                    <option value="180">6 months ago</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Price
                  <select value={values.priceOrder} onChange={(event) => setValues((current) => ({ ...current, priceOrder: event.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Default order</option>
                    <option value="expensive">Most Expensive</option>
                    <option value="cheap">Most Cheap</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Parent category
                  <select value={values.parentCategory} onChange={(event) => setValues((current) => ({ ...current, parentCategory: event.target.value, category: "" }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">All parent categories</option>
                    {parents.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Child category
                  <select value={values.category} disabled={!values.parentCategory || children.length === 0} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                    <option value="">All children</option>
                    {children.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              </div>
              <fieldset className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <legend className="mb-2 font-medium">Brand type</legend>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={values.branded} disabled={values.local} onChange={(event) => setValues((current) => ({ ...current, branded: event.target.checked }))} />
                  Branded Items (Has a brand name)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={values.local} disabled={values.branded} onChange={(event) => setValues((current) => ({ ...current, local: event.target.checked }))} />
                  Local Items (Brand = Local)
                </label>
              </fieldset>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 text-sm font-medium">
                  <span>Price Range (Min to Max)</span>
                  <span className="text-muted-foreground">PKR {values.minPrice.toLocaleString("en-PK")} – {values.maxPrice.toLocaleString("en-PK")}</span>
                </div>
                <Slider
                  value={[values.minPrice, values.maxPrice]}
                  min={0}
                  max={priceCeiling}
                  step={Math.max(1, Math.floor(priceCeiling / 100))}
                  minStepsBetweenThumbs={1}
                  aria-label="Price range"
                  onValueChange={(range) => setValues((current) => ({ ...current, minPrice: range[0] ?? 0, maxPrice: range[1] ?? priceCeiling }))}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" onClick={resetFilters}>Reset filters</Button>
                <Button type="submit">Apply filters</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
