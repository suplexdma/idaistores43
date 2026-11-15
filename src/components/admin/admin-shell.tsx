"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Package,
  Settings,
  ShoppingCart,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type AdminShellProps = {
  children: React.ReactNode;
  name: string;
  email: string;
  accessLevel: string;
};

const navigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/reviews", label: "Reviews", icon: Star, editorOnly: true },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/sales-agent", label: "AI Sales Agent", icon: Bot },
  { href: "/admin/notes-tasks", label: "Notes & Tasks", icon: NotebookPen, editorOnly: true },
  { href: "/admin/posts", label: "Posts", icon: FileText, editorOnly: true },
  { href: "/admin/trash", label: "Trash", icon: Trash2 },
  { href: "/admin/settings", label: "Settings", icon: Settings, fullAccessOnly: true },
];

export function AdminShell({ children, name, email, accessLevel }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => setMobileOpen(false), [pathname]);

  const visibleNavigation = navigation.filter(({ editorOnly, fullAccessOnly }) =>
    (!editorOnly || accessLevel !== "View Only") &&
    (!fullAccessOnly || accessLevel === "Full Access"),
  );

  async function logout() {
    setSigningOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out.");
      router.replace("/admin/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <>
        <Link href="/admin" className="flex items-center gap-3 px-2 py-2">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white p-1 shadow-lg shadow-black/15">
            <Image
              src="/images/idai-stores-43-logo.png"
              alt="IDAI Stores 43 logo"
              width={56}
              height={56}
              sizes="56px"
              className="size-12 object-contain"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-wide text-white">IDAI STORES 43</span>
            <span className="mt-0.5 block text-xs text-white/50">Store management</span>
          </span>
          {mobile && (
            <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="ml-auto grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
              <X className="size-5" />
            </button>
          )}
        </Link>

        <div className="mb-3 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Workspace
        </div>
        <nav aria-label="Admin navigation" className="space-y-1">
          {visibleNavigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-brand-olive text-white shadow-md shadow-black/10"
                    : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <Icon aria-hidden="true" className={`size-[18px] ${active ? "text-white" : "text-white/50 group-hover:text-brand-gold"}`} />
                <span className="flex-1">{label}</span>
                {active && <span className="size-1.5 rounded-full bg-brand-gold" />}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gold/15 text-sm font-semibold text-brand-gold">
              {(name.trim()[0] || email[0] || "A").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white">{name}</span>
              <span className="mt-0.5 block truncate text-[10px] text-white/45">{accessLevel}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={signingOut}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
          {logoutError && <p role="alert" className="mt-2 px-3 text-xs text-red-300">{logoutError}</p>}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f3] text-brand-charcoal">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-[#20231f] px-4 py-5 shadow-xl shadow-black/5 md:flex">
        <SidebarContent />
      </aside>

      <div className="min-h-screen md:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-black/[0.06] bg-white/90 px-4 backdrop-blur-xl sm:px-7">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-black/10 text-brand-charcoal transition hover:bg-black/[0.04] md:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-charcoal">
              {navigation.find((item) => item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href))?.label ?? "Admin"}
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">IDAI STORES 43 · Admin workspace</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-right text-xs font-medium text-brand-charcoal sm:block">{name}</span>
            <span className="rounded-full border border-brand-olive/20 bg-brand-olive/10 px-3 py-1.5 text-[11px] font-semibold text-brand-olive">{accessLevel}</span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={signingOut}
              className="hidden items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs font-medium text-brand-charcoal transition hover:border-black/20 hover:bg-black/[0.03] lg:inline-flex"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation overlay"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[min(84vw,300px)] flex-col bg-[#20231f] px-4 py-5 shadow-2xl md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            >
              <SidebarContent mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
