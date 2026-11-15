import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartHydration } from "@/components/storefront/cart-hydration";
import { AiChat } from "@/components/storefront/ai-chat";
import { StorefrontFooter } from "@/components/storefront/footer";
import { FloatingActions } from "@/components/storefront/floating-actions";
import { StorefrontHeader } from "@/components/storefront/header";

export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <CartHydration />
      <StorefrontHeader />
      <main className="min-h-[60vh]">{children}</main>
      <StorefrontFooter />
      <CartDrawer />
      <AiChat />
      <FloatingActions />
    </>
  );
}
