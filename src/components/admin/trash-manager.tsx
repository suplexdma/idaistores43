"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TrashItem = {
  id: string;
  entityType: "product" | "order" | "post" | "note" | "task";
  originalId: string;
  title: string;
  deletedAt: string;
};

const typeNames: Record<TrashItem["entityType"], string> = {
  product: "Product",
  order: "Order",
  post: "Post",
  note: "Note",
  task: "Task",
};

export function TrashManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/trash");
      const data = (await response.json()) as { items?: TrashItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load Trash.");
      setItems(data.items ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Trash.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTrash(); }, [loadTrash]);

  async function act(action: "restore" | "permanentlyDelete" | "all", id?: string) {
    if (action === "permanentlyDelete" && !window.confirm("Permanently delete this item? This cannot be undone.")) return;
    if (action === "all" && !window.confirm(`Permanently delete all ${items.length} items in Trash? This cannot be undone.`)) return;
    setBusy(id ?? "all");
    setError("");
    try {
      const response = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "all" ? { action } : { action, id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to complete Trash action.");
      await loadTrash();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to complete Trash action.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-brand-olive">Store management</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Trash</h1>
          <p className="mt-2 text-muted-foreground">Items stay here until restored or permanently deleted.</p>
        </div>
        {canManage && <Button variant="destructive" disabled={items.length === 0 || busy !== ""} onClick={() => void act("all")}>Delete All</Button>}
      </div>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader><CardTitle>{items.length} deleted item{items.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading Trash...</p> : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Trash is empty.</p>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                  <div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{typeNames[item.entityType]}</span>
                    <p className="mt-2 font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Deleted {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(item.deletedAt))} PKT</p>
                  </div>
                  {canManage && <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => void act("restore", item.id)}>Restore</Button>
                    <Button size="sm" variant="destructive" disabled={busy !== ""} onClick={() => void act("permanentlyDelete", item.id)}>Permanently Delete</Button>
                  </div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
