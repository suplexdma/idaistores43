import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin sign in | IDAI STORES 43",
};

type AdminLoginPageProps = {
  searchParams: { next?: string };
};

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage products and store operations.
          </p>
        </div>
        <LoginForm nextPath={searchParams.next} />
      </div>
    </main>
  );
}
