import { redirect } from "next/navigation";
import { SettingsManager } from "@/components/admin/settings-manager";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session || session.accessLevel !== "Full Access") redirect("/admin");
  return <SettingsManager />;
}
