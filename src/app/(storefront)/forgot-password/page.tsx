import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password | IDAI STORES 43" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col justify-center px-5 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Account help</p>
        <h1 className="mt-2 text-3xl font-semibold">Forgot your password?</h1>
      </div>
      <ForgotPasswordForm />
    </main>
  );
}
