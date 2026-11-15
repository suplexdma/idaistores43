import { redirect } from "next/navigation";
import { PostsManager } from "@/components/admin/posts-manager";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminPostsPage() {
  const session = await getAdminSession();
  if (!session || session.accessLevel === "View Only") redirect("/admin");
  return <PostsManager />;
}
