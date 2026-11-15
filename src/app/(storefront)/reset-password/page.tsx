import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password | IDAI STORES 43" };

type Props = { searchParams: { email?: string } };

export default function ResetPasswordPage({ searchParams }: Props) {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col justify-center px-5 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Account help</p>
        <h1 className="mt-2 text-3xl font-semibold">Set a new password</h1>
      </div>
      <ResetPasswordForm email={searchParams.email ?? ""} />
    </main>
  );
}
