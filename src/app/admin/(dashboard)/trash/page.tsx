import { TrashManager } from "@/components/admin/trash-manager";
import { getAdminSession } from "@/lib/admin-session";

export default async function TrashPage() {
  const session = await getAdminSession();
  return <TrashManager canManage={session?.accessLevel === "Full Access"} />;
}
