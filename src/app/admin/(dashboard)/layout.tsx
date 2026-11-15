import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell
      name={session.name || session.email}
      email={session.email}
      accessLevel={session.accessLevel}
    >
      {children}
    </AdminShell>
  );
}
