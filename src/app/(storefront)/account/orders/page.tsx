import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account/account-dashboard";
import { authOptions } from "@/lib/auth-options";
import { connectToDatabase } from "@/lib/db";
import User, { type User as UserSchema } from "@/models/User";

export const metadata: Metadata = { title: "My orders | IDAI STORES 43" };
export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) redirect("/login");

  await connectToDatabase();
  const user = await User.findById(session.user.id).select("name email phone addresses").lean();
  if (!user) redirect("/login");

  return (
    <AccountDashboard
      initialTab="orders"
      profile={{
        name: user.name,
        email: user.email,
        phone: user.phone,
        addresses: user.addresses.map((address: UserSchema["addresses"][number]) => ({
          id: address._id.toString(),
          label: address.label,
          name: address.name,
          phone: address.phone,
          address: address.address,
          area: address.area,
          city: address.city,
          isDefault: address.isDefault,
        })),
      }}
    />
  );
}
