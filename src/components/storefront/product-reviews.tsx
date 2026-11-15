"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ApprovedReview = {
  id: string;
  reviewer: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export function ProductReviews({
  slug,
  reviews,
}: {
  slug: string;
  reviews: ApprovedReview[];
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const result = (await response.json()) as { message?: string; error?: string | { message?: string }[] };
      if (!response.ok) {
        const detail = Array.isArray(result.error)
          ? result.error.map((issue) => issue.message).filter(Boolean).join(" ")
          : result.error;
        throw new Error(detail ?? "Unable to submit your review.");
      }
      setMessage(result.message ?? "Thanks for your review. It will appear after moderation.");
      setRating(0);
      setComment("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-16 border-t border-border pt-10" aria-labelledby="product-reviews-title">
      <h2 id="product-reviews-title" className="text-2xl font-semibold">Customer reviews</h2>
      <form onSubmit={(event) => void submitReview(event)} className="mt-6 max-w-2xl space-y-4 rounded-xl border bg-white p-5">
        <h3 className="font-semibold">Write a review</h3>
        <fieldset>
          <legend className="text-sm font-medium">Your rating</legend>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-olive"
                >
                  <Star className={`size-6 ${value <= rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground"}`} />
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block space-y-2 text-sm font-medium">
          Review
          <Textarea
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share your experience with this product."
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error === "Sign in to write a review." ? (
              <><Link href={`/login?callbackUrl=${encodeURIComponent(`/product/${slug}`)}`} className="underline">Sign in</Link> to submit your review.</>
            ) : error}
          </p>
        )}
        {message && <p role="status" className="text-sm text-brand-olive">{message}</p>}
        <Button type="submit" disabled={submitting || rating === 0}>
          {submitting ? "Submitting..." : "Submit review"}
        </Button>
      </form>

      <div className="mt-8 grid max-w-3xl gap-4">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">{review.reviewer}</p>
              <time className="text-xs text-muted-foreground" dateTime={review.createdAt}>
                {new Date(review.createdAt).toLocaleDateString("en-PK")}
              </time>
            </div>
            <div className="mt-2 flex" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} aria-hidden="true" className={`size-4 ${index < review.rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{review.comment}</p>
          </article>
        ))}
        {reviews.length === 0 && (
          <p className="text-sm text-muted-foreground">No approved reviews yet. Be the first to share your experience.</p>
        )}
      </div>
    </section>
  );
}
