"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language";
import { PUBLIC_WHATSAPP_NUMBER } from "@/lib/whatsapp";

const categoryLabelsUr: Record<string, string> = {
  stationery: "اسٹیشنری",
  toys: "کھلونے",
  gifts: "تحائف",
  kitchenware: "کچن کا سامان",
  "beauty-personal-care": "خوبصورتی اور ذاتی نگہداشت",
  "household-items": "گھریلو اشیاء",
  "baby-care": "بچوں کی دیکھ بھال",
  "home-decor": "گھر کی سجاوٹ",
  "plastic-items": "پلاسٹک کی اشیاء",
  bags: "بیگز",
  "water-bottles": "پانی کی بوتلیں",
  "lunch-boxes-storage": "لنچ باکس اور اسٹوریج",
};

export function StorefrontFooter() {
  const { language, t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [subscribed, setSubscribed] = useState(false);
  const [categories, setCategories] = useState<{ _id: string; name: string; slug?: string }[]>([]);
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/categories", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          categories?: { _id: string; name: string; slug?: string }[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Unable to load categories.");
        setCategories(data.categories ?? []);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Footer category loading failed:", error);
          setCategoryError(
            error instanceof Error ? error.message : "Unable to load categories.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribed(true);
  }

  return (
    <footer id="contact" className="bg-brand-charcoal text-white">
      <div className="border-b border-white/10 bg-[#24251f] px-4 py-2.5 text-center text-[10px] tracking-wide text-white/75 sm:py-3 sm:text-xs">
        {t("deliveryBanner")}
      </div>
      <div className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full border border-brand-gold/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full border border-brand-olive/20" />
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: reducedMotion ? 0 : 0.45 }}
          className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-5 lg:py-16"
        >
        <div>
          <Link
            href="/"
            aria-label="IDAI STORES 43 home"
            className="inline-flex"
          >
            <Image
              src="/images/idai-stores-43-logo.png"
              alt="IDAI STORES 43"
              width={86}
              height={108}
              sizes="80px"
              className="h-24 w-auto object-contain"
            />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/65">
            {t("footerTagline")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Follow IDAI STORES 43">
            <SocialLink label="Facebook" href="https://www.facebook.com/idaistores43" color="#1877F2" path={<path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.3v3h2.8v8h3.4Z" />} />
            <SocialLink label="Instagram" href="https://www.instagram.com/idaistores43/" color="#C13584" path={<><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.5" cy="6.8" r="0.8" fill="currentColor" stroke="none" /></>} />
            <SocialLink label="TikTok" href="https://www.tiktok.com/@idaistores" color="#111111" path={<><path d="M14 4v10.1a3.1 3.1 0 1 1-2.8-3.1V8.1a6.1 6.1 0 1 0 5.8 6V9.2c1.3 1 2.8 1.5 4 1.5V7.5c-3.6-.1-4.6-2.5-4.8-3.5H14Z" /><path d="M19.2 6.8a5.2 5.2 0 0 1-1.1-2.1" /></>} />
            <SocialLink label="Threads" href="https://www.threads.com/@idaistores43" color="#333333" path={<><path d="M18.5 10.1c-.4-3.4-2.5-5.3-6.1-5.3-4.1 0-6.7 2.8-6.7 7.2 0 4.6 2.6 7.2 6.8 7.2 3.6 0 5.8-1.7 5.8-4.5 0-2.2-1.5-3.6-4.1-3.9-2.6-.3-4 .5-4 2.1 0 1.1.8 1.8 2 1.8 1.6 0 2.6-1.1 2.7-3" /><path d="M14.7 9.1c1.9.4 3.1 1.4 3.8 3" /></>} />
            <SocialLink label="YouTube" href="https://www.youtube.com/@idaistores43" color="#FF0033" path={<><rect x="3.5" y="6" width="17" height="12" rx="3.5" /><path d="m10 9 5 3-5 3V9Z" fill="#fff" stroke="none" /></>} />
            <SocialLink label="Pinterest" href="https://www.pinterest.com/idaistores43/" color="#BD081C" path={<path d="M12 3.2a8.8 8.8 0 0 0-3.2 17c0-.7 0-1.6.2-2.4l1.2-5.2s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.6 0 1-.7 2.6-1 4-.3 1.2.6 2.1 1.8 2.1 2.1 0 3.5-2.7 3.5-5.8 0-2.4-1.6-4.2-4.5-4.2-3.3 0-5.3 2.5-5.3 5.2 0 .9.3 1.9.8 2.4.2.3.3.4.2.7l-.3 1c-.1.3-.3.4-.6.3-1.6-.7-2.3-2.4-2.3-4.4 0-3.3 2.8-7.3 8.3-7.3 4.4 0 7.3 3.2 7.3 6.7 0 4.6-2.5 8-6.1 8-1.2 0-2.4-.7-2.8-1.5l-.8 3.1c-.3.9-.8 1.8-1.2 2.5A8.8 8.8 0 1 0 12 3.2Z" />} />
          </div>
          </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">{t("explore")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li><Link href="/shop" className="hover:text-white">{t("shopAll")}</Link></li>
            <li><Link href="/about" className="hover:text-white">{t("ourStory")}</Link></li>
            <li><Link href="/blog" className="hover:text-white">Journal</Link></li>
            <li><Link href="/contact" className="hover:text-white">{t("contact")}</Link></li>
            <li><Link href="/#benefits" className="hover:text-white">{t("deliveryReturns")}</Link></li>
            <li><Link href="/cart" className="hover:text-white">{t("yourCart")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">{t("categories")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {categories.slice(0, 5).map((category) => (
              <li key={category._id}>
                <Link href={`/shop?category=${category._id}`} className="hover:text-white">
                  {language === "ur"
                    ? categoryLabelsUr[category.slug ?? ""] ?? category.name
                    : category.name}
                </Link>
              </li>
            ))}
            {categoryError ? (
              <li className="text-xs text-white/50">{categoryError}</li>
            ) : categories.length === 0 ? (
              <li><Link href="/shop" className="hover:text-white">{t("browseAll")}</Link></li>
            ) : null}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">{t("getInTouch")}</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-gold" />
              <span>{t("servingPakistan")}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone aria-hidden="true" className="size-4 shrink-0 text-brand-gold" />
              <a href="tel:+923278505273" className="hover:text-white">0327 8505273</a>
            </li>
            <li className="flex items-center gap-3">
              <MessageCircle aria-hidden="true" className="size-4 shrink-0 text-brand-gold" />
              <a href={`https://wa.me/${PUBLIC_WHATSAPP_NUMBER}`} className="hover:text-white">{t("whatsapp")}</a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">{t("newsletter")}</h2>
          <p className="mt-4 text-sm leading-6 text-white/70">
            {t("newsletterText")}
          </p>
          <form onSubmit={subscribe} className="mt-4 flex gap-2">
            <Input
              type="email"
              required
              aria-label={t("emailAddress")}
              placeholder={t("emailAddress")}
              className="min-w-0 border-white/20 bg-white/10 text-white placeholder:text-white/45"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              {t("join")}
            </Button>
          </form>
          {subscribed && (
            <p role="status" className="mt-2 text-xs text-brand-gold">
              {t("newsletterThanks")}
            </p>
          )}
        </div>
        </motion.div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/45">
        © {new Date().getFullYear()} IDAI STORES 43. {t("allRightsReserved")}
        <p className="mt-2 text-[11px] tracking-wide text-white/55">
          Made by Suplex DMA (Best Performance Marketing Agency)
        </p>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  color,
  path,
}: {
  href: string;
  label: string;
  color: string;
  path: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="group flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white transition duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" style={{ "--social-color": color } as React.CSSProperties}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current transition-colors group-hover:text-[var(--social-color)]" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </a>
  );
}
