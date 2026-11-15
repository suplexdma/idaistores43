"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminLogoutButton() {
  const router = useRouter();

  async function logout() {
    const response = await fetch("/api/auth/admin/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error("Unable to sign out.");
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      className="justify-start"
      onClick={() => void logout().catch((error: unknown) => console.error(error))}
    >
      Sign out
    </Button>
  );
}
