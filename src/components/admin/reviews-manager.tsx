"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
  product: { name: string; slug: string };
  customer: { name: string; email: string };
};

export function ReviewsManager({ canManage }: { canManage: boolean }) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadReviews = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/reviews", { signal });
      const result = (await response.json()) as { reviews?: ReviewItem[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load reviews.");
      setReviews(result.reviews ?? []);
      setError("");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load reviews.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadReviews(controller.signal);
    return () => controller.abort();
  }, [loadReviews]);

  async function setStatus(review: ReviewItem, status: "Approved" | "Rejected") {
    setBusy(review.id);
    setError("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, status }),
      });
      const result = (await response.json()) as { error?: string; status?: ReviewItem["status"] };
      if (!response.ok || !result.status) {
        throw new Error(result.error ?? "Unable to update this review.");
      }
      const updatedStatus = result.status;
      setReviews((current) => current.map((item) =>
        item.id === review.id ? { ...item, status: updatedStatus } : item,
      ));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this review.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <div role="status" aria-label="Loading reviews" className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No customer reviews yet.</p>
        ) : reviews.map((review) => (
          <article key={review.id} className="rounded-xl border p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="font-semibold">
                  {review.product.slug
                    ? <Link href={`/product/${review.product.slug}`} target="_blank" className="hover:text-brand-olive hover:underline">{review.product.name}</Link>
                    : review.product.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{review.customer.name}{review.customer.email ? ` · ${review.customer.email}` : ""}</p>
                <div className="mt-2 flex" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} aria-hidden="true" className={`size-4 ${index < review.rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  review.status === "Approved" ? "bg-emerald-100 text-emerald-800" :
                    review.status === "Rejected" ? "bg-red-100 text-red-800" :
                      "bg-amber-100 text-amber-900"
                }`}>{review.status}</span>
                {canManage && review.status !== "Approved" && (
                  <Button size="sm" disabled={busy !== ""} onClick={() => void setStatus(review, "Approved")}>
                    {busy === review.id ? "Saving..." : "Approve"}
                  </Button>
                )}
                {canManage && review.status !== "Rejected" && (
                  <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => void setStatus(review, "Rejected")}>
                    Reject
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{review.comment}</p>
            <time className="mt-3 block text-xs text-muted-foreground" dateTime={review.createdAt}>
              {new Date(review.createdAt).toLocaleDateString("en-PK")}
            </time>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
