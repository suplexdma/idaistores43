"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;
type LoginFormProps = { nextPath?: string };

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setServerError("");
    try {
      const response = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setServerError(data.error ?? "Unable to sign in.");
        return;
      }

      const safePath =
        nextPath?.startsWith("/admin/") && nextPath !== "/admin/login"
          ? nextPath
          : "/admin";
      router.replace(safePath);
      router.refresh();
    } catch {
      setServerError("Unable to reach the sign-in service. Please try again.");
    }
  }

  return (
    <Card className="border-border/70 shadow-lg">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Use your administrator account credentials.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" toggleLabel="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
