import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminToken,
  legacyRoleForAccessLevel,
} from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(12).max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .optional(),
});

export async function GET() {
  const session = await requireAdmin(["SuperAdmin"]);
  if (!session) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json({
    profile: { name: session.name, email: session.email },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin(["SuperAdmin"]);
  if (!session) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let input: z.infer<typeof profileSchema>;
  try {
    input = profileSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid profile." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const admin = await AdminUser.findById(session.sub).select("+passwordHash");
    if (!admin) return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
    const email = input.email.toLowerCase();
    const credentialsChanged = email !== admin.email || Boolean(input.newPassword);
    if (credentialsChanged) {
      if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, admin.passwordHash))) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
      }
    }

    admin.name = input.name;
    admin.email = email;
    if (input.newPassword) admin.passwordHash = await bcrypt.hash(input.newPassword, 12);
    await admin.save();

    const accessLevel = admin.accessLevel ?? session.accessLevel;
    const token = await createAdminToken({
      id: admin._id.toString(),
      email: admin.email,
      role: legacyRoleForAccessLevel(accessLevel),
      accessLevel,
      name: admin.name,
    });
    const response = NextResponse.json({ profile: { name: admin.name, email: admin.email } });
    response.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions);
    return response;
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    console.error("Admin profile update failed:", error);
    return NextResponse.json({ error: "Unable to update admin profile." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
