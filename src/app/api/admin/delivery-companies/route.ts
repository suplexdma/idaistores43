import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import DeliveryCompany from "@/models/DeliveryCompany";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  contactNumber: z.string().trim().max(30).optional(),
  trackingUrlTemplate: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await connectToDatabase();
  const companies = await DeliveryCompany.find().sort({ name: 1 }).lean();
  return NextResponse.json({ companies });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  await connectToDatabase();
  try {
    const company = await DeliveryCompany.create(parsed.data);
    const admin = await getAdminSession();
    await AuditLog.create({ actorId: admin?.sub, actorEmail: admin?.email, action: "create", entityType: "deliveryCompany", entityId: company._id, changes: parsed.data });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return NextResponse.json({ error: "A delivery company with this name already exists." }, { status: 409 });
    return NextResponse.json({ error: "Unable to save delivery company." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
  const parsed = schema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  await connectToDatabase();
  const before = await DeliveryCompany.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Delivery company not found." }, { status: 404 });
  const company = await DeliveryCompany.findByIdAndUpdate(id, { $set: parsed.data }, { new: true, runValidators: true });
  const admin = await getAdminSession();
  await AuditLog.create({ actorId: admin?.sub, actorEmail: admin?.email, action: "update", entityType: "deliveryCompany", entityId: id, changes: { before, after: company } });
  return NextResponse.json({ company });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
  await connectToDatabase();
  const company = await DeliveryCompany.findByIdAndDelete(id);
  if (!company) return NextResponse.json({ error: "Delivery company not found." }, { status: 404 });
  const admin = await getAdminSession();
  await AuditLog.create({ actorId: admin?.sub, actorEmail: admin?.email, action: "delete", entityType: "deliveryCompany", entityId: id, changes: company });
  return NextResponse.json({ deleted: true });
}
