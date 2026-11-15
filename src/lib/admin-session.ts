import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  accessLevelForLegacyRole,
  legacyRoleForAccessLevel,
  type AdminRole,
  type AdminTokenPayload,
  verifyAdminToken,
} from "@/lib/admin-auth";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifyAdminToken(token);
  if (!session) return null;
  await connectToDatabase();
  const admin = await AdminUser.findById(session.sub).select("name email role accessLevel").lean();
  if (!admin) return null;
  const accessLevel = admin.accessLevel ?? accessLevelForLegacyRole(admin.role);
  return {
    ...session,
    email: admin.email,
    role: legacyRoleForAccessLevel(accessLevel),
    accessLevel,
    name: admin.name || admin.email,
  };
}

export async function requireAdmin(
  allowedRoles?: AdminRole[],
): Promise<AdminTokenPayload | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (!allowedRoles) return session;
  if (allowedRoles.includes("SuperAdmin") && session.accessLevel === "Full Access") return session;
  if (allowedRoles.includes("Manager") && session.accessLevel !== "View Only") return session;
  if (allowedRoles.includes("Support") && session.accessLevel === "View Only") return session;
  return null;
}
