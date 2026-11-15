import { CustomersTable } from "@/components/admin/customers-table";
import { getAdminSession } from "@/lib/admin-session";

export default async function CustomersPage() {
  const session = await getAdminSession();
  return <CustomersTable canEdit={session?.accessLevel !== "View Only"} />;
}
