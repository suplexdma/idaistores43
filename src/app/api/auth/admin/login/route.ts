import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  accessLevelForLegacyRole,
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminToken,
  legacyRoleForAccessLevel,
} from "@/lib/admin-auth";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const admin = await AdminUser.findOne({ email: input.email.toLowerCase() }).select(
      "+passwordHash",
    );
    if (!admin || !(await bcrypt.compare(input.password, admin.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const accessLevel = admin.accessLevel ?? accessLevelForLegacyRole(admin.role);
    const token = await createAdminToken({
      id: admin._id.toString(),
      email: admin.email,
      role: legacyRoleForAccessLevel(accessLevel),
      accessLevel,
      name: admin.name || admin.email,
    });
    const response = NextResponse.json({
      admin: { name: admin.name || admin.email, email: admin.email, role: accessLevel },
    });
    response.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions);
    return response;
  } catch (error) {
    console.error("Admin login failed:", error);
    return NextResponse.json({ error: "Unable to complete login." }, { status: 500 });
  }
}
