"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductCard, type StorefrontProduct } from "@/components/storefront/product-card";
import { useLanguage } from "@/lib/language";

type StorefrontCategory = { _id: string; name: string; slug: string };
type ListingResponse = { products?: StorefrontProduct[]; error?: string };
type CategoryResponse = { categories?: StorefrontCategory[]; error?: string };

const categoryImages = [
  { slug: "beauty-personal-care", name: "Beauty & Personal Care", image: "category-beauty-general.jpg" },
  { slug: "household-organizers", name: "Household & Organizers", image: "category-household-general.jpg" },
  { slug: "kitchen-items", name: "Kitchen Items", image: "category-kitchen-general.jpg" },
  { slug: "home-decoration", name: "Home Decoration", image: "category-home-decoration-general.jpg" },
  { slug: "bags", name: "Bags", image: "category-bags-general.jpg" },
  { slug: "fashion-accessories", name: "Fashion Accessories", image: "category-fashion-accessories.jpg" },
] as const;

const categoryLabelsUr = [
  "خوبصورتی اور ذاتی نگہداشت",
  "گھریلو سامان اور آرگنائزرز",
  "کچن کا سامان",
  "گھر کی سجاوٹ",
  "بیگز",
  "فیشن کے لوازمات",
];

const heroSlides = [
  {
    src: "/images/hero-cover-1.jpg",
    alt: "IDAI STORES 43 curated stationery, gifts, home decor, and everyday accessories",
  },
  {
    src: "/images/hero-cover-2.jpg",
    alt: "A colorful display of IDAI STORES 43 non-food products and accessories",
  },
  {
    src: "/images/hero-cover-3.jpg",
    alt: "Thoughtful home, kitchen, stationery, and gift finds from IDAI STORES 43",
  },
] as const;

const trustBadges = [
  { icon: ShieldCheck, title: "originalProducts", detail: "thoughtfulPicks" },
  { icon: Truck, title: "freeDelivery", detail: "deliveryCharge" },
  { icon: RotateCcw, title: "easyReturns", detail: "deliveryReturns" },
  { icon: CreditCard, title: "cod", detail: "payOnDelivery" },
] as const;

export function StorefrontHome() {
  const { language, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [productsLoading, setProductsLoading] = useState(true);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<StorefrontProduct[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [productError, setProductError] = useState("");
  const [trendingError, setTrendingError] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadContent() {
      const [categoryResult, productResult, trendingResult] = await Promise.allSettled([
        fetch("/api/categories", { signal: controller.signal }),
        fetch("/api/products?sort=newest&limit=16&includeTotal=false", { signal: controller.signal }),
        fetch("/api/products?sort=trending&limit=8&includeTotal=false", { signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      if (categoryResult.status === "fulfilled") {
        const data = (await categoryResult.value.json()) as CategoryResponse;
        if (categoryResult.value.ok) setCategories(data.categories ?? []);
        else setCategoryError(data.error ?? "Unable to load categories.");
      } else {
        setCategoryError(
          categoryResult.reason instanceof Error
            ? categoryResult.reason.message
            : "Unable to load categories.",
        );
      }

      if (productResult.status === "fulfilled") {
        const data = (await productResult.value.json()) as ListingResponse;
        if (productResult.value.ok) setProducts(data.products ?? []);
        else setProductError(data.error ?? "Unable to load products.");
      } else {
        setProductError(
          productResult.reason instanceof Error
            ? productResult.reason.message
            : "Unable to load products.",
        );
      }
      if (trendingResult.status === "fulfilled") {
        const data = (await trendingResult.value.json()) as ListingResponse;
        if (trendingResult.value.ok) setTrendingProducts(data.products ?? []);
        else setTrendingError(data.error ?? "Unable to load trending products.");
      } else {
        setTrendingError(
          trendingResult.reason instanceof Error
            ? trendingResult.reason.message
            : "Unable to load trending products.",
        );
      }
      setProductsLoading(false);
    }

    void loadContent().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setProductError(error instanceof Error ? error.message : "Unable to load products.");
      setProductsLoading(false);
    });
    return () => controller.abort();
  }, []);

  const categoryHref = (slug: string, name: string) => {
    const category = categories.find((entry) => entry.slug === slug);
    return category
      ? `/shop?category=${encodeURIComponent(category._id)}`
      : `/shop?search=${encodeURIComponent(name)}`;
  };

  return (
    <div className="overflow-hidden bg-[#fffefa] text-brand-charcoal">
      <section className="relative isolate flex min-h-[520px] items-center overflow-hidden bg-brand-charcoal sm:min-h-[610px] lg:min-h-[680px]">
        <AnimatePresence initial={false}>
          <motion.div
            key={heroSlides[heroIndex].src}
            initial={prefersReducedMotion ? false : { opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Image
              src={heroSlides[heroIndex].src}
              alt={heroSlides[heroIndex].alt}
              fill
              priority={heroIndex === 0}
              sizes="100vw"
              quality={88}
              className="object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        <div
          className="relative z-10 mx-auto w-full max-w-7xl px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12"
        >
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm sm:text-xs">
              <span className="size-1.5 rounded-full bg-brand-gold" />
              {t("sectionEyebrow")}
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight drop-shadow sm:text-6xl lg:text-7xl">
              {language === "ur" ? t("heroTitle") : <>Purpose Is More Important Than <span className="italic text-brand-gold">Need.</span></>}
            </h1>
            <p className="mt-4 text-xl font-medium tracking-tight text-white/95 drop-shadow sm:mt-6 sm:text-3xl">{t("oneStoreManyChoices")}</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/80 sm:text-base">{t("heroDescription")}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-12 rounded-full bg-brand-olive px-7 text-white shadow-[0_8px_28px_rgba(123,160,91,0.45)] transition hover:-translate-y-0.5 hover:bg-brand-olive/90">
                <Link href="/shop">{t("shopNow")}<ArrowRight aria-hidden="true" className="ms-2 size-4 rtl-flip" /></Link>
              </Button>
              <Link href="#shop-by-category" className="text-sm font-semibold text-white underline decoration-brand-gold underline-offset-4 transition hover:text-brand-gold">{t("browseCategories")}</Link>
            </div>
            <p className="mt-6 text-xs font-medium text-white/75">{t("cashDelivery")} <span className="mx-1 text-brand-gold">·</span> {t("freeDelivery")}</p>
          </div>
        </div>
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2 sm:bottom-8 sm:right-8">
          <button type="button" aria-label="Previous hero image" onClick={() => setHeroIndex((heroIndex + heroSlides.length - 1) % heroSlides.length)} className="flex size-10 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white backdrop-blur transition hover:bg-white hover:text-brand-charcoal"><ArrowLeft className="size-4" /></button>
          {heroSlides.map((slide, index) => (
            <button key={slide.src} type="button" aria-label={`Show slide ${index + 1}`} aria-current={heroIndex === index} onClick={() => setHeroIndex(index)} className={`h-1.5 rounded-full transition-all ${heroIndex === index ? "w-7 bg-brand-gold" : "w-1.5 bg-white/75"}`} />
          ))}
          <button type="button" aria-label="Next hero image" onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)} className="flex size-10 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white backdrop-blur transition hover:bg-white hover:text-brand-charcoal"><ArrowRight className="size-4" /></button>
        </div>
      </section>

      <section id="shop-by-category" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-olive sm:text-xs">{t("findSomething")}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{t("shopByCategory")}</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("curatedFinds")}</p>
          </div>
          <Link href="/shop" className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-brand-olive hover:text-brand-charcoal sm:inline-flex">
            {t("browseAll")} <ArrowRight aria-hidden="true" className="size-4 rtl-flip" />
          </Link>
        </div>
        {categoryError && (
          <p role="status" className="mb-4 text-xs text-muted-foreground">
            Showing featured non-food categories. Catalog filters will be available when the store is online.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {categoryImages.map((category, index) => {
            return (
              <motion.div
                key={category.slug}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: prefersReducedMotion ? 0 : (index % 4) * 0.035 }}
              >
                <Link
                  href={categoryHref(category.slug, category.name)}
                  className="group flex min-h-[112px] items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.04] bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-olive/25 hover:shadow-xl sm:min-h-[160px] sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-2xl sm:p-3"
                >
                  <span className="relative size-[68px] shrink-0 overflow-hidden rounded-xl bg-white sm:h-32 sm:w-full sm:rounded-xl lg:h-40">
                    <Image
                      src={`/images/${category.image}`}
                      alt={language === "ur" ? categoryLabelsUr[index] : category.name}
                      fill
                      sizes="(max-width: 640px) 68px, (max-width: 1024px) 30vw, 22vw"
                      quality={85}
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </span>
                  <span className="min-w-0 flex-1 sm:mt-3 sm:px-1">
                    <span className="line-clamp-2 block text-xs font-semibold leading-5 text-brand-charcoal sm:text-sm">
                      {language === "ur" ? categoryLabelsUr[index] : category.name}
                    </span>
                    <span className="mt-1 hidden items-center gap-1 text-[10px] font-medium text-brand-olive sm:inline-flex sm:text-xs">
                      {t("viewCollection")} <ArrowRight aria-hidden="true" className="size-3 rtl-flip" />
                    </span>
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <ProductRail
        id="new-arrivals"
        title={t("newArrivals")}
        eyebrow={t("freshlyAdded")}
        products={products.slice(0, 8)}
        loading={productsLoading}
        error={productError}
        language={language}
        emptyText={t("newProductsSoon")}
        actionText={t("shopAll")}
        actionHref="/shop?sort=newest"
        reducedMotion={Boolean(prefersReducedMotion)}
      />

      <ProductRail
        id="trending-now"
        title={t("trendingNow")}
        eyebrow={t("thoughtfulPicks")}
        products={trendingProducts}
        loading={productsLoading}
        error={trendingError}
        language={language}
        emptyText={t("newProductsSoon")}
        actionText={t("browseAll")}
        actionHref="/shop"
        reducedMotion={Boolean(prefersReducedMotion)}
        alternate
      />

      <section id="benefits" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
          className="mb-8 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-olive sm:text-xs">{t("thoughtfulPicks")}</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{language === "ur" ? "آئی ڈائی کا انتخاب کیوں؟" : "Why Choose IDAI"}</h2>
        </motion.div>
        <div className="overflow-hidden rounded-[1.75rem] bg-brand-charcoal text-white shadow-[0_18px_50px_rgba(26,26,26,0.16)]">
          <div className="grid grid-cols-2 divide-x divide-y divide-white/10 sm:grid-cols-4 sm:divide-y-0">
            {trustBadges.map(({ icon: Icon, title, detail }, index) => (
              <motion.article
                key={title}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.35, delay: prefersReducedMotion ? 0 : index * 0.06 }}
                className="flex min-h-[150px] flex-col items-center justify-center px-4 py-7 text-center sm:min-h-[188px] sm:px-5"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-olive/15 text-brand-gold ring-1 ring-brand-gold/20">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-4 text-xs font-semibold sm:text-sm">{t(title)}</h3>
                <p className="mt-1.5 max-w-[190px] text-[10px] leading-5 text-white/55 sm:text-xs">{t(detail)}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="border-t border-black/[0.04] bg-[#f7f7f2]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-12">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.65, delay: prefersReducedMotion ? 0 : 0.08 }}
            className="max-w-2xl"
          >
            <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-olive sm:text-xs">
              <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
              {language === "ur" ? "ہماری کہانی" : "A little about us"}
            </p>
            <p className="mt-6 font-serif text-lg italic leading-relaxed text-brand-olive sm:text-xl">{t("homeAboutHeading")}</p>
            <h2 className="mt-3 max-w-2xl font-serif text-3xl font-medium leading-[1.14] tracking-[-0.035em] text-brand-charcoal sm:text-4xl lg:text-5xl">
              Elegant home decoration accessories selected by{" "}
              <span className="italic text-brand-olive">IDAI STORES 43</span>
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-brand-charcoal/70 sm:text-base sm:leading-8">{t("homeAboutText")}</p>
            <p className="mt-3 max-w-xl text-sm leading-7 text-brand-charcoal/60 sm:text-base sm:leading-8">
              {language === "ur"
                ? "ہم اسٹیشنری، کھلونے، تحائف اور گھر کے مفید سامان کو ایک آسان اور خوشگوار خریداری کے تجربے میں یکجا کرتے ہیں۔"
                : "We bring stationery, toys, gifts, and useful home essentials together in one warm, considered shopping experience."}
            </p>
            <Button asChild className="mt-8 rounded-full bg-brand-olive px-7 text-white shadow-[0_6px_20px_rgba(123,160,91,0.25)] transition hover:-translate-y-0.5 hover:bg-brand-olive/90">
              <Link href="/about">{language === "ur" ? "ہماری کہانی جانیں" : "Discover our story"}<ArrowRight aria-hidden="true" className="ms-2 size-4 rtl-flip" /></Link>
            </Button>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, x: 12 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.7 }}
            className="relative mx-auto w-full max-w-[420px]"
          >
            <span aria-hidden="true" className="absolute -inset-3 rounded-full border border-brand-gold/45" />
            <div className="relative aspect-square overflow-hidden rounded-full bg-white shadow-[0_24px_70px_rgba(26,26,26,0.16)]">
              <Image
                src="/images/category-home-decoration-general.jpg"
                alt="Elegant home decoration accessories selected by IDAI STORES 43"
                fill
                sizes="(max-width: 1024px) 80vw, 34vw"
                className="object-cover"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-tr from-brand-charcoal/25 via-transparent to-brand-gold/10" />
            </div>
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-3 right-0 flex h-[82px] w-[152px] items-center justify-center rounded-2xl border border-white/80 bg-white/95 px-4 shadow-xl backdrop-blur sm:-right-3"
            >
              <Image
                src="/images/idai-stores-43-logo.png"
                alt="IDAI STORES 43"
                width={144}
                height={88}
                sizes="144px"
                className="h-full w-full object-contain"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#f7f7f2] px-5 py-12 sm:px-8 sm:py-16">
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: prefersReducedMotion ? 0 : 0.45 }} className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-[1.75rem] bg-brand-charcoal px-6 py-9 text-center text-white sm:flex-row sm:px-10 sm:text-start">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold">{t("thoughtfulPicks")}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">{language === "ur" ? "اپنی پسند دریافت کرنے کے لیے تیار ہیں؟" : "Find your next thoughtful pick."}</h2>
            <p className="mt-2 text-sm text-white/65">{language === "ur" ? "ہماری پسندیدہ غیر غذائی مصنوعات دیکھیں۔" : "Explore a considered collection of non-food essentials."}</p>
          </div>
          <Button asChild className="shrink-0 rounded-full bg-brand-gold px-6 text-brand-charcoal hover:bg-brand-gold/90">
            <Link href="/shop">{t("shopNow")}<ArrowRight aria-hidden="true" className="ms-2 size-4 rtl-flip" /></Link>
          </Button>
        </motion.div>
      </section>
    </div>
  );
}

function ProductRail({
  id,
  title,
  eyebrow,
  products,
  loading,
  error,
  language,
  emptyText,
  actionText,
  actionHref,
  reducedMotion,
  alternate = false,
}: {
  id: string;
  title: string;
  eyebrow: string;
  products: StorefrontProduct[];
  loading: boolean;
  error: string;
  language: "en" | "ur";
  emptyText: string;
  actionText: string;
  actionHref: string;
  reducedMotion: boolean;
  alternate?: boolean;
}) {
  return (
    <section id={id} className={alternate ? "bg-[#f7f7f2]" : "bg-white"}>
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-olive sm:text-xs">{eyebrow}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Link href={actionHref} className="hidden items-center gap-2 text-sm font-semibold text-brand-olive hover:text-brand-charcoal sm:inline-flex">
              {actionText} <ArrowRight aria-hidden="true" className="size-4 rtl-flip" />
            </Link>
            <div className="hidden gap-2 sm:flex">
              <button
                type="button"
                aria-label={language === "ur" ? "دائیں اسکرول کریں" : "Scroll products left"}
                onClick={() => document.getElementById(`${id}-rail`)?.scrollBy({ left: language === "ur" ? 320 : -320, behavior: reducedMotion ? "instant" : "smooth" })}
                className="flex size-10 items-center justify-center rounded-full border border-brand-charcoal/10 bg-white text-brand-charcoal transition hover:border-brand-olive hover:text-brand-olive"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label={language === "ur" ? "بائیں اسکرول کریں" : "Scroll products right"}
                onClick={() => document.getElementById(`${id}-rail`)?.scrollBy({ left: language === "ur" ? -320 : 320, behavior: reducedMotion ? "instant" : "smooth" })}
                className="flex size-10 items-center justify-center rounded-full border border-brand-charcoal/10 bg-white text-brand-charcoal transition hover:border-brand-olive hover:text-brand-olive"
              >
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </div>
        {loading ? (
          <div role="status" aria-label={`Loading ${title}`} className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="w-[68%] shrink-0 animate-pulse sm:w-[31%] lg:w-[23%]">
                <div className="aspect-[4/5] rounded-2xl bg-[#eeefe9]" />
                <div className="mt-3 h-4 w-2/3 rounded bg-[#eeefe9]" />
                <div className="mt-2 h-4 w-1/3 rounded bg-[#eeefe9]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="status" className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-muted-foreground">{emptyText}</p>
        ) : products.length > 0 ? (
          <div
            id={`${id}-rail`}
            aria-label={title}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin] [scrollbar-color:#719347_transparent] sm:gap-5"
          >
            {products.map((product) => (
              <div key={product._id} className="w-[70%] shrink-0 snap-start sm:w-[32%] lg:w-[23.5%]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
