import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import ExternalProductMapping from "@/models/ExternalProductMapping";
import Product from "@/models/Product";

const schema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i),
  paperBillSku: z.string().trim().max(100).optional(),
  paperBillBarcode: z.string().trim().max(100).optional(),
  paperBillName: z.string().trim().max(200).optional(),
});

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await connectToDatabase();
  const mappings = await ExternalProductMapping.find().populate("productId", "name sku barcode").sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ mappings });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  await connectToDatabase();
  if (!(await Product.exists({ _id: parsed.data.productId, deletedAt: null }))) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const mapping = await ExternalProductMapping.findOneAndUpdate(
    { productId: parsed.data.productId },
    { $set: parsed.data },
    { upsert: true, new: true, runValidators: true },
  );
  const admin = await getAdminSession();
  await AuditLog.create({ actorId: admin?.sub, actorEmail: admin?.email, action: "upsert", entityType: "externalProductMapping", entityId: mapping._id, changes: parsed.data });
  return NextResponse.json({ mapping });
}
