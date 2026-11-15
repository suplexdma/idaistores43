import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create an account | IDAI STORES 43" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg flex-col justify-center px-5 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-olive">Join us</p>
        <h1 className="mt-2 text-3xl font-semibold">A more personal shop</h1>
      </div>
      <RegisterForm />
    </main>
  );
}
