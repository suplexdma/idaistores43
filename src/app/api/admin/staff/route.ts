import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { legacyRoleForAccessLevel } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

const staffSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
  accessLevel: z.enum(["View Only", "Editor", "Full Access"]),
});

export async function GET() {
  if (!(await requireAdmin(["SuperAdmin"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  try {
    await connectToDatabase();
    const staff = await AdminUser.find().select("name email role accessLevel createdAt").sort({ createdAt: 1 }).lean();
    return NextResponse.json({
      staff: staff.map((member) => ({
        id: member._id.toString(),
        name: member.name || member.email,
        email: member.email,
        accessLevel: member.accessLevel ?? (member.role === "SuperAdmin" ? "Full Access" : member.role === "Manager" ? "Editor" : "View Only"),
        createdAt: member.createdAt,
      })),
    });
  } catch (error) {
    console.error("Staff listing failed:", error);
    return NextResponse.json({ error: "Unable to load staff members." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  let input: z.infer<typeof staffSchema>;
  try {
    input = staffSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid staff details." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const staff = await AdminUser.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await bcrypt.hash(input.password, 12),
      accessLevel: input.accessLevel,
      role: legacyRoleForAccessLevel(input.accessLevel),
    });
    return NextResponse.json({ id: staff._id.toString() }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That staff email already exists." }, { status: 409 });
    console.error("Staff creation failed:", error);
    return NextResponse.json({ error: "Unable to create staff member." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
