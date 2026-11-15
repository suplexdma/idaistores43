import { redirect } from "next/navigation";
import { ReviewsManager } from "@/components/admin/reviews-manager";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminReviewsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-olive">Store management</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-charcoal sm:text-[2rem]">Reviews</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review customer feedback and approve the reviews shown on product pages.</p>
      </div>
      <ReviewsManager canManage={session.accessLevel !== "View Only"} />
    </div>
  );
}
