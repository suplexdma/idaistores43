import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { CheckoutForm, type CheckoutPrefill } from "@/components/storefront/checkout-form";
import { authOptions } from "@/lib/auth-options";
import { connectToDatabase } from "@/lib/db";
import User, { type User as UserSchema } from "@/models/User";

export const metadata: Metadata = { title: "Checkout | IDAI STORES 43" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  let prefill: CheckoutPrefill = {};

  if (session?.user.id) {
    await connectToDatabase();
    const user = await User.findById(session.user.id)
      .select("name email phone addresses")
      .lean();
    if (user) {
      const defaultAddress =
        user.addresses.find(
          (address: UserSchema["addresses"][number]) => address.isDefault,
        ) ?? user.addresses[0];
      prefill = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        city: defaultAddress?.city,
        address: defaultAddress?.address,
      };
    }
  }

  return <CheckoutForm prefill={prefill} />;
}
