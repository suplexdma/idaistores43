"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ProductRowActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteProduct() {
    if (!window.confirm(`Move “${name}” to Trash?`)) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to move product to Trash.");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to move product to Trash.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/products/${id}/edit`}><Pencil aria-hidden="true" className="mr-2 size-3.5" />Edit</Link>
      </Button>
      <Button size="icon" variant="ghost" aria-label={`Move ${name} to Trash`} disabled={deleting} onClick={() => void deleteProduct()}>
        <Trash2 aria-hidden="true" className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
