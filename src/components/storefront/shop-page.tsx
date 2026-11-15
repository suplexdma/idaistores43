"use client";

import { Filter, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ProductCard, type StorefrontProduct } from "@/components/storefront/product-card";
import { useLanguage } from "@/lib/language";

type StorefrontCategory = { _id: string; name: string; slug: string };
type ProductResponse = {
  products?: StorefrontProduct[];
  pagination?: { page: number; pages: number; total: number };
  error?: string | { message?: string }[];
};

type Filters = {
  categories: string[];
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  minRating: string;
  sort: "newest" | "price-asc" | "price-desc";
};

const initialFilters: Filters = {
  categories: [],
  minPrice: "",
  maxPrice: "",
  inStock: false,
  minRating: "",
  sort: "newest",
};

type FilterPanelProps = {
  categories: StorefrontCategory[];
  filters: Filters;
  onChange: (filters: Filters) => void;
};

export function ShopPage() {
  const { direction } = useLanguage();
  const [initialSearch, setInitialSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInitialSearch(params.get("search") ?? "");
    setFilters((current) => ({
      ...current,
      categories: params.getAll("category"),
    }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/categories", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { categories?: StorefrontCategory[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load categories.");
        setCategories(data.categories ?? []);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load categories.");
      });
    return () => controller.abort();
  }, []);

  const categoryKey = useMemo(() => filters.categories.join(","), [filters.categories]);
  const selectedCategories = useMemo(
    () => (categoryKey ? categoryKey.split(",") : []),
    [categoryKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      limit: "12",
      sort: filters.sort,
    });
    if (initialSearch) query.set("search", initialSearch);
    for (const id of selectedCategories) query.append("category", id);
    if (filters.minPrice) query.set("minPrice", filters.minPrice);
    if (filters.maxPrice) query.set("maxPrice", filters.maxPrice);
    if (filters.inStock) query.set("inStock", "true");
    if (filters.minRating) query.set("minRating", filters.minRating);

    setLoading(true);
    setError("");
    void fetch(`/api/products?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as ProductResponse;
        if (!response.ok) {
          const message = typeof data.error === "string" ? data.error : "Unable to load products.";
          throw new Error(message);
        }
        setProducts(data.products ?? []);
        setPages(data.pagination?.pages ?? 0);
        setTotal(data.pagination?.total ?? 0);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load products.");
        setProducts([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [initialSearch, page, filters.sort, filters.minPrice, filters.maxPrice, filters.inStock, filters.minRating, selectedCategories]);

  function changeFilters(nextFilters: Filters) {
    setPage(1);
    setFilters(nextFilters);
  }

  function clearFilters() {
    changeFilters({ ...initialFilters });
  }

  const filterPanel = (
    <FilterPanel categories={categories} filters={filters} onChange={changeFilters} />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-9 sm:px-7 sm:py-12 lg:px-10">
      <div className="mb-8 border-b border-border/70 pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">The IDAI edit</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Shop all</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Discover considered pieces for everyday life, selected with purpose.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 pb-5 lg:hidden">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline"><Filter aria-hidden="true" className="size-4" />Filters</Button>
          </SheetTrigger>
          <SheetContent side={direction === "rtl" ? "right" : "left"} className="w-[min(90vw,360px)] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><SlidersHorizontal className="size-4" /> Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">{filterPanel}</div>
          </SheetContent>
        </Sheet>
        <p className="text-sm text-muted-foreground">{total} {total === 1 ? "item" : "items"}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-44 rounded-xl border border-border/70 bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold">Filters</h2>
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
            {filterPanel}
          </div>
        </aside>
        <section aria-label="Products">
          <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
            <p className="hidden text-sm text-muted-foreground lg:block">
              {loading ? "Finding your next favorite..." : `${total} ${total === 1 ? "product" : "products"}`}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="shop-sort" className="hidden text-sm text-muted-foreground sm:block">Sort by</label>
              <Select
                value={filters.sort}
                onValueChange={(value: Filters["sort"]) => changeFilters({ ...filters, sort: value })}
              >
                <SelectTrigger id="shop-sort" className="w-[180px]">
                  <SelectValue placeholder="Sort products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  <SelectItem value="price-desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
          {loading && products.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="aspect-[4/5] rounded-xl bg-muted" />
                  <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-4 w-1/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : products.length ? (
            <>
              <div className={`grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 ${loading ? "opacity-50" : ""}`}>
                {products.map((product) => <ProductCard key={product._id} product={product} />)}
              </div>
              {pages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-4">
                  <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
                  <Button variant="outline" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </>
          ) : !error ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <SlidersHorizontal aria-hidden="true" className="mx-auto size-8 text-muted-foreground/50" />
              <h2 className="mt-4 text-lg font-semibold">Nothing matches just yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters or browse the full collection.</p>
              <Button variant="outline" className="mt-5" onClick={clearFilters}>
                <X aria-hidden="true" className="size-4" /> Clear filters
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FilterPanel({ categories, filters, onChange }: FilterPanelProps) {
  function toggleCategory(id: string, checked: boolean) {
    const next = checked
      ? [...filters.categories, id]
      : filters.categories.filter((categoryId) => categoryId !== id);
    onChange({ ...filters, categories: next });
  }

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="text-sm font-semibold">Category</legend>
        <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">
          {categories.map((category) => (
            <label key={category._id} className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={filters.categories.includes(category._id)}
                onCheckedChange={(checked) => toggleCategory(category._id, checked === true)}
              />
              <span>{category.name}</span>
            </label>
          ))}
          {categories.length === 0 && <p className="text-xs text-muted-foreground">No categories available.</p>}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Price range (PKR)</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            aria-label="Minimum price"
            value={filters.minPrice}
            onChange={(event) => onChange({ ...filters, minPrice: event.target.value })}
          />
          <Input
            type="number"
            min="0"
            placeholder="Max"
            aria-label="Maximum price"
            value={filters.maxPrice}
            onChange={(event) => onChange({ ...filters, maxPrice: event.target.value })}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Customer rating</legend>
        <Select
          value={filters.minRating || "any"}
          onValueChange={(value) => onChange({ ...filters, minRating: value === "any" ? "" : value })}
        >
          <SelectTrigger className="mt-3"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any rating</SelectItem>
            <SelectItem value="4">4 stars & up</SelectItem>
            <SelectItem value="3">3 stars & up</SelectItem>
            <SelectItem value="2">2 stars & up</SelectItem>
          </SelectContent>
        </Select>
      </fieldset>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">In stock only</span>
        <Checkbox
          checked={filters.inStock}
          onCheckedChange={(checked) => onChange({ ...filters, inStock: checked === true })}
        />
      </label>
    </div>
  );
}
