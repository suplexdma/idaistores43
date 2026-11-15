import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";
import { AdminSetupForm } from "@/components/admin/admin-setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Initial admin setup",
};

export default async function AdminSetupPage() {
  await connectToDatabase();
  if (await AdminUser.exists({})) {
    redirect("/admin/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image
            src="/images/idai-stores-43-logo.png"
            alt="IDAI Stores 43 logo"
            width={96}
            height={108}
            sizes="96px"
            className="mx-auto mb-4 h-24 w-auto object-contain"
          />
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create your admin account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One-time setup for the first store administrator.
          </p>
        </div>
        <AdminSetupForm />
      </div>
    </main>
  );
}
