import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import DeliveryCompany from "@/models/DeliveryCompany";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  contactPersonName: z.string().trim().max(120).optional(),
  contactNumber: z.string().trim().max(30).optional(),
  officeLocation: z.string().trim().max(300).optional(),
  paymentMethod: z.enum(["Cash", "Bank Transfer"]).optional(),
  paymentDelayDays: z.number().int().min(0).max(365).optional(),
  trackingUrlTemplate: z.string().trim().max(500).optional(),
  serviceRates: z.array(z.object({
    minWeight: z.number().finite().min(0),
    maxWeight: z.number().finite().min(0),
    charge: z.number().finite().min(0),
  }).refine((rate) => rate.maxWeight >= rate.minWeight, {
    message: "Rate maximum weight must be at least the minimum weight.",
    path: ["maxWeight"],
  })).max(50).optional(),
  customAttributes: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(300),
  })).max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().optional(),
});

function validateCompanyInput(input: Partial<z.infer<typeof schema>>) {
  if (input.trackingUrlTemplate) {
    const url = input.trackingUrlTemplate.replaceAll("{trackingNumber}", "TRACKING_NUMBER");
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return "Tracking URL must use HTTP or HTTPS.";
    } catch {
      return "Enter a valid tracking URL template.";
    }
  }
  if (input.serviceRates) {
    const rates = [...input.serviceRates].sort((a, b) => a.minWeight - b.minWeight);
    for (let index = 1; index < rates.length; index += 1) {
      if (rates[index].minWeight <= rates[index - 1].maxWeight) {
        return "Weight-rate ranges cannot overlap.";
      }
    }
  }
  if (input.customAttributes) {
    const names = input.customAttributes.map((attribute) => attribute.name.toLowerCase());
    if (new Set(names).size !== names.length) return "Custom attribute names must be unique.";
  }
  return null;
}

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
  const inputError = validateCompanyInput(parsed.data);
  if (inputError) return NextResponse.json({ error: inputError }, { status: 400 });
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
  const inputError = validateCompanyInput(parsed.data);
  if (inputError) return NextResponse.json({ error: inputError }, { status: 400 });
  await connectToDatabase();
  const before = await DeliveryCompany.findById(id).lean();
  if (!before) return NextResponse.json({ error: "Delivery company not found." }, { status: 404 });
  const company = await DeliveryCompany.findByIdAndUpdate(id, { $set: parsed.data }, { new: true, runValidators: true }).lean();
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
