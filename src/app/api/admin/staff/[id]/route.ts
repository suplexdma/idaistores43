import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { legacyRoleForAccessLevel } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AdminUser from "@/models/AdminUser";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .optional(),
  accessLevel: z.enum(["View Only", "Editor", "Full Access"]).optional(),
}).refine((value) => Object.keys(value).length > 0);
type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
  let input: z.infer<typeof updateSchema>;
  try {
    input = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid update." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const current = await AdminUser.findById(params.id).select("role accessLevel");
    if (!current) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    const currentLevel = current.accessLevel ?? (current.role === "SuperAdmin" ? "Full Access" : current.role === "Manager" ? "Editor" : "View Only");
    if (currentLevel === "Full Access" && input.accessLevel && input.accessLevel !== "Full Access") {
      const fullAccessCount = await AdminUser.countDocuments({
        $or: [{ accessLevel: "Full Access" }, { accessLevel: { $exists: false }, role: "SuperAdmin" }],
      });
      if (fullAccessCount <= 1) {
        return NextResponse.json({ error: "The last Full Access admin cannot be demoted." }, { status: 409 });
      }
    }
    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.email !== undefined) update.email = input.email.toLowerCase();
    if (input.password) update.passwordHash = await bcrypt.hash(input.password, 12);
    if (input.accessLevel) {
      update.accessLevel = input.accessLevel;
      update.role = legacyRoleForAccessLevel(input.accessLevel);
    }
    const staff = await AdminUser.findByIdAndUpdate(params.id, { $set: update }, { new: true, runValidators: true }).select("name email role accessLevel");
    return NextResponse.json({ staff: { id: staff?._id.toString(), name: staff?.name, email: staff?.email, accessLevel: staff?.accessLevel } });
  } catch (error) {
    if (isDuplicateKeyError(error)) return NextResponse.json({ error: "That staff email already exists." }, { status: 409 });
    console.error("Staff update failed:", error);
    return NextResponse.json({ error: "Unable to update staff member." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!(await requireAdmin(["SuperAdmin"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: "Invalid staff id." }, { status: 400 });
  try {
    await connectToDatabase();
    const target = await AdminUser.findById(params.id).select("role accessLevel");
    if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    const accessLevel = target.accessLevel ?? (target.role === "SuperAdmin" ? "Full Access" : target.role === "Manager" ? "Editor" : "View Only");
    if (accessLevel === "Full Access") {
      const fullAccessCount = await AdminUser.countDocuments({
        $or: [{ accessLevel: "Full Access" }, { accessLevel: { $exists: false }, role: "SuperAdmin" }],
      });
      if (fullAccessCount <= 1) {
        return NextResponse.json({ error: "The last Full Access admin cannot be deleted." }, { status: 409 });
      }
    }
    await AdminUser.deleteOne({ _id: params.id });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Staff delete failed:", error);
    return NextResponse.json({ error: "Unable to delete staff member." }, { status: 500 });
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
