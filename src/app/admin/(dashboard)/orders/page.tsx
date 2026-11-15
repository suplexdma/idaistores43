import { OrdersTable } from "@/components/admin/orders-table";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminOrdersPage() {
  const session = await getAdminSession();
  return <OrdersTable canEdit={session?.accessLevel !== "View Only"} />;
}
