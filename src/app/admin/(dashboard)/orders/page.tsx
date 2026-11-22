import { OrderManagement } from "@/components/admin/order-management";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminOrdersPage() {
  const session = await getAdminSession();
  return <OrderManagement canEdit={session?.accessLevel !== "View Only"} />;
}
