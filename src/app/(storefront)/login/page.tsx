import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in | IDAI STORES 43" };

type Props = { searchParams: { callbackUrl?: string; registered?: string } };

export default function LoginPage({ searchParams }: Props) {
  const callback = searchParams.callbackUrl;
  const callbackUrl =
    callback?.startsWith("/") && !callback.startsWith("//")
      ? callback
      : "/account";

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col justify-center px-5 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Your IDAI account</p>
        <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
      </div>
      {searchParams.registered === "true" && (
        <p role="status" className="mb-4 rounded-md bg-brand-olive/10 p-3 text-sm text-brand-olive">
          Your account is ready. Sign in to continue.
        </p>
      )}
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
