"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCartStore } from "@/lib/cart-store";
import { useLanguage } from "@/lib/language";

const links = [
  { href: "/", label: "home" },
  { href: "/shop", label: "shop" },
  { href: "/about", label: "about" },
  { href: "/contact", label: "contact" },
] as const;

export function StorefrontHeader() {
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const previousScroll = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const count = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0),
  );
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  useEffect(() => {
    function updateHeader() {
      const current = window.scrollY;
      if (current < 100 || current < previousScroll.current - 6) {
        setHidden(false);
      } else if (current > previousScroll.current + 6 && current > 140) {
        setHidden(true);
      }
      previousScroll.current = current;
    }
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setHidden(false);
      window.setTimeout(() => searchInput.current?.focus(), 40);
    }
  }, [searchOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) {
      searchInput.current?.focus();
      return;
    }
    setSearchOpen(false);
    router.push(`/shop?search=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-black/5 bg-brand-white/95 shadow-sm backdrop-blur-md transition-transform duration-300 ease-out ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <AnnouncementBar />
        <div dir="ltr" className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="IDAI STORES 43 home" className="shrink-0">
            <Image
              src="/images/idai-stores-43-logo.png"
              alt="IDAI STORES 43"
              width={72}
              height={88}
              sizes="(max-width: 640px) 46px, 56px"
              className="h-12 w-auto object-contain sm:h-14"
            />
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t("search")}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-brand-charcoal/10 bg-white px-3 text-start text-xs text-brand-charcoal/55 transition hover:border-brand-olive/50 hover:bg-brand-olive/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-olive/30 sm:h-11 sm:px-4 sm:text-sm"
          >
            <Search aria-hidden="true" className="size-4 shrink-0 text-brand-olive" />
            <span className="truncate">{t("search")}</span>
          </button>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <div className="hidden sm:block"><LanguageToggle /></div>
            <Link href="/account" className="hidden size-10 items-center justify-center rounded-full text-brand-charcoal hover:bg-muted sm:inline-flex" aria-label={t("account")}>
              <UserRound aria-hidden="true" className="size-5" />
            </Link>
            <Link href="/wishlist" className="hidden size-10 items-center justify-center rounded-full text-brand-charcoal hover:bg-muted sm:inline-flex" aria-label={t("wishlist")}>
              <Heart aria-hidden="true" className="size-5" />
            </Link>
            <Link href="/cart" className="relative inline-flex size-9 items-center justify-center rounded-full text-brand-charcoal hover:bg-muted sm:size-10" aria-label={`${t("cart")}${hasHydrated ? `, ${count} items` : ""}`}>
              <ShoppingBag aria-hidden="true" className="size-5" />
              {hasHydrated && count > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-brand-olive text-[10px] font-semibold text-white">{count > 99 ? "99+" : count}</span>
              )}
            </Link>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"}>
                {mobileOpen ? <X /> : <Menu />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(85vw,340px)]">
              <SheetHeader><SheetTitle className="text-start">{t("explore")}</SheetTitle></SheetHeader>
              <nav className="mt-8 flex flex-col gap-2">
                {links.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted">{t(link.label)}</Link>
                ))}
                <Link href="/account" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted">{t("account")}</Link>
                <Link href="/wishlist" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted">{t("wishlist")}</Link>
                <div className="pt-3"><LanguageToggle /></div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        <nav aria-label="Main navigation" className="hidden border-t border-black/5 md:block">
          <ul className="mx-auto flex max-w-7xl items-center justify-center gap-10 px-8 py-2.5">
            {links.map((link) => <li key={link.href}><Link href={link.href} className="text-sm font-medium text-brand-charcoal/80 transition-colors hover:text-brand-olive">{t(link.label)}</Link></li>)}
          </ul>
        </nav>
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-brand-charcoal/45 px-3 pt-[12vh] backdrop-blur-sm sm:px-6" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="store-search-title" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <h2 id="store-search-title" className="font-serif text-lg font-semibold">Find your next thoughtful pick</h2>
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" className="rounded-full p-2 text-brand-charcoal/70 hover:bg-muted"><X className="size-5" /></button>
            </div>
            <form onSubmit={submitSearch} role="search" className="flex items-center gap-3 p-4 sm:p-5">
              <Search aria-hidden="true" className="size-5 shrink-0 text-brand-olive" />
              <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }} type="search" maxLength={100} placeholder="Search stationery, toys, bags…" aria-label="Search products" className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <Button type="submit" className="rounded-full px-5">Search</Button>
            </form>
            <p className="px-5 pb-5 text-xs text-muted-foreground">Search our non-food collection: stationery, toys, gifts, kitchenware, bags, and more.</p>
          </section>
        </div>
      )}
    </>
  );
}

function AnnouncementBar() {
  const { t } = useLanguage();
  return <div className="bg-brand-charcoal px-3 py-1.5 text-center text-[10px] tracking-wide text-white/90 sm:py-2 sm:text-xs">{t("deliveryBanner")}</div>;
}

function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div role="group" aria-label="Language" className="inline-flex items-center gap-0.5 rounded-full border border-border bg-white p-1">
      {(["en", "ur"] as const).map((value) => (
        <button key={value} type="button" lang={value} aria-pressed={language === value} onClick={() => setLanguage(value)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${language === value ? "bg-brand-olive text-white" : "text-brand-charcoal/70 hover:bg-muted"}`}>
          {value === "en" ? t("english") : t("urdu")}
        </button>
      ))}
    </div>
  );
}
