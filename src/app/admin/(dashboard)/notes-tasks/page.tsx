import { NotesTasksManager } from "@/components/admin/notes-tasks-manager";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";

export default async function NotesTasksPage() {
  const session = await getAdminSession();
  if (!session || session.accessLevel === "View Only") redirect("/admin");
  return <NotesTasksManager />;
}
