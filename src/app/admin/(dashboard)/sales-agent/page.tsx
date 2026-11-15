import { SalesAgentSessions } from "@/components/admin/sales-agent-sessions";
import { getAdminSession } from "@/lib/admin-session";

export default async function SalesAgentPage() {
  const session = await getAdminSession();
  return <SalesAgentSessions canDelete={session?.accessLevel === "Full Access"} />;
}
